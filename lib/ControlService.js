/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
poke = require('./Common'),
util = require('util'),
base = require('./BaseService'),
spawn = require('child_process').spawn,
path = require('path');

function ControlService(opts) {
  // encoding for stan must be binary.
  opts.encoding = 'binary';
  this.services = {};
  this.init(opts);
  this.on('connect', this.handleConnect.bind(this));
  this.on('close', this.handleClose.bind(this));
  this.on('ready', (function() {
    if(this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    var f = this.checkEntries.bind(this);
    f();
    this.checkInterval = setInterval(f, 30 * 1000);
  }).bind(this));
}

exports.ControlService = ControlService;
util.inherits(ControlService, base.BaseService);


ControlService.prototype.handleConnect = function(nc) {
  // we use a NATS connection to read genesis events. Queues used to distribute the
  // processing of incoming data
  var queueGroup = this.opts.queue || '';
  // subject name in the heartbeat has the service type, and the client id
  var subj = poke.makeSubject(poke.POKENATS, '*', '*', poke.HB);
  this.monintoringSub = nc.subscribe(subj, queueGroup, this.handleMonitoring.bind(this));
  this.loginfo('[S] ' + subj + '[' + queueGroup +']');

  this.nc.request(poke.PROCESS_DISCOVERY_PROP, {max:20}, (function(msg, reply, subject) {
    try {
      var m = JSON.parse(msg);
      this.updateEntry(m);
    } catch(err) {
      this.badRequest({msg: msg, reply: reply, subject: subject, err: err});
    }
  }));
  this.emit('ready');
};

ControlService.prototype.updateEntry = function(status) {
  if(!status.client || !status.serviceType) {
    throw new Error('Missing required fields.');
  }

  status.expires = Date.now() + poke.POKENATS_SERVICE_HB_INTERVAL + 5000;

  if(! this.services[status.serviceType]) {
    this.services[status.serviceType] = {};
  }
  var service = this.services[status.serviceType];
  service[status.client] = status;
};

function needsService(now, services) {
  var running = 0;
  for(var client in services) {
    var entry = services[client];
    var diff = entry.expires - now;
    if(diff < 0) {
      delete services[client];
    } else {
      running++;
    }
  }
  return running < 1;
}

function spawnService(serviceType) {
  var node = process.argv[0];
  var script = [path.resolve(path.dirname(process.argv[1]), serviceType + '.js')];
  this.loginfo('Spawning ' + serviceType + ' [' + script + '] as none were found.');
  return spawn(node, script);
}

ControlService.prototype.startIfNone = function(){
  var types = ['invalid-message', 'trainer-data', 'eden-service'];
  var now = Date.now();
  types.forEach((function(serviceType, index) {
    if(needsService(now, this.services[serviceType])) {
      var s = spawnService.call(this, serviceType);
      s.stdout.on('data', function(data) {
      });
      s.stderr.on('data', function(data) {
      });
      s.stderr.on('close', function(code) {
        console.log('process exited ' + code);
      });
    }
  }).bind(this));
};

ControlService.prototype.checkEntries = function() {
  this.startIfNone();
};

ControlService.prototype.handleMonitoring = function(msg, reply, subject) {
  var chunks = subject.split('.');
  var serviceType = chunks[chunks.length-2];
  var client = chunks[chunks.length-1];

  var d = {serviceType: serviceType, client: client};
  try {
    this.updateEntry(d);
  } catch(err) {
    this.badRequest({msg: msg, reply: reply, subject: subject, err: err});
  }

};

ControlService.prototype.handleClose = function(nc) {
  nc.unsubscribe(this.monintoringSub);
};


