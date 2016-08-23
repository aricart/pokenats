/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
nats = require('nats'),
poke = require('./Common'),
util = require('util'),
events = require('events');

function BaseService() {
  events.EventEmitter.call(this);
  return this;
}

/**
 * Initializes the BaseService with the provided properties.
 * This method must be called with the opts argument, if any
 * connection options are required.
 * @param opts
 */
BaseService.prototype.init = function(opts){
  events.EventEmitter.call(this);
  this.opts = opts;
};


exports.BaseService = BaseService;
util.inherits(BaseService, events.EventEmitter);



/**
 * Connects to the NATS server, and subscribes to trainer events
 */
BaseService.prototype.connect = function() {
  if(! this.opts) {
    console.log('Connect called without opts being set. Maybe call BaseService#setOpts().');
  }
  var nc = nats.connect(this.opts);
  nc.on('connect', this.baseHandleConnect.bind(this));
  nc.on('connect', (function() {
    if(this.serviceHbInterval) {
      clearInterval(this.serviceHbInterval);
      delete this.serviceHbInterval;
    }
    this.serviceHbInterval = setInterval(this.sendHeartbeat.bind(this), poke.POKENATS_SERVICE_HB_INTERVAL*.75);
    this.sendHeartbeat();
  }).bind(this));
  nc.on('connect', (function() {
    this.nc.subscribe(poke.POKENATS_ADMIN + '.>', this.forwardAdminRequest.bind(this));
  }).bind(this));
};

BaseService.prototype.forwardAdminRequest = function(msg, reply, subject) {
  try {
    var chunks = subject.split('.');
    var verb = chunks[1];
    var serviceType = chunks[2] || this.opts.serviceType;
    var client = chunks[3] || this.opts.client;


    if(serviceType !== this.opts.serviceType) {
      return;
    }

    if(client !== this.opts.client) {
      return;
    }

    switch(verb) {
      case poke.DISCOVER:
        if(! reply) {
          this.badRequest({msg: msg, reply: reply, subject: subject, err: 'Reply was not specified'});
          return;
        }
        this.nc.publish(reply, JSON.stringify({client: this.opts.client, serviceType: this.opts.serviceType}));
        break;
      case poke.KILL:
        this.logInfo('Process shutting down because of remote admin request.');
        this.close();
        process.exit(1);
        break;
      case poke.CONF:
        // specific client needs to evaluate
        try {
          var m = JSON.parse(msg);
          this.emit('admin-request', m);
        } catch(err) {
          this.badRequest({subject: subject, msg: msg, err: err});
        }
        break;
    }
  } catch(err) {
    this.badRequest({msg: msg, err: err, subject: subject});
  }
};

BaseService.prototype.baseHandleConnect = function(nc) {
  this.nc = nc;
  this.emit('connect', nc);
};

BaseService.prototype.getConnection = function() {
  return this.nc;
};

BaseService.prototype.isClosed = function() {
  return this.nc === undefined;
};

/**
 * Closes the connection to the NATS server.
 */
BaseService.prototype.close = function() {
  if(! this.isClosed()) {
    var nc = this.nc;
    this.emit('closing', nc);
    delete this['nc'];
    nc.flush(function(err) {
      if(err) {
        this.logError(err);
      }
      nc.close();
    });
  }
};


/**
 * Forwards bad/malformed requests to the invalid-message-service
 * @param data
 */
BaseService.prototype.badRequest = function(data) {
  var m = JSON.stringify(data);
  var subject = poke.makeSubject(poke.POKENATS, this.opts.serviceType, this.opts.client, poke.LOG, poke.INVALID);
  this.logError('[P] ' + subject + ': ' + m);
  this.nc.publish(subject, m);
  if(this.listenerCount('error')) {
    this.emit('error', data);
  }
};

function log(subject) {
  var m = '';
  for(var i=1; i < arguments.length; i++) {
    if(m.length > 0) {
      m += ' ';
    }
    m += typeof arguments[i] === 'object' ? JSON.stringify(arguments[i]) : arguments[i];
  }
  console.log(m);
  if(this.nc) {
    this.nc.publish(subject, m);
  }
}

BaseService.prototype.logError = function() {
  var args = [];
  var subj = poke.makeSubject(poke.POKENATS,
    this.opts.serviceType || 'unknown-service',
    this.opts.client || 'unknown-client',
    poke.LOG,
    poke.ERROR);
  args.push(subj);
  for(var i=0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  log.apply(this, args);
};

BaseService.prototype.logInfo = function() {
  var args = [];
  var subj = poke.makeSubject(poke.POKENATS,
    this.opts.serviceType || 'unknown-service',
    this.opts.client || 'unknown-client',
    poke.LOG,
    poke.INFO);
  args.push(subj);
  for(var i=0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  log.apply(this, args);
};

BaseService.prototype.sendHeartbeat = function() {
  if(this.nc) {
    var s = poke.makeSubject(poke.POKENATS_MONITOR,
      this.opts.serviceType || 'unknown-service',
      this.opts.client || 'unknown-client',
      poke.HB);
    this.nc.publish(s);
  }
};
