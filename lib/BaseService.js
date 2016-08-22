/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
nats = require('nats'),
poke = require('./Common');
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
 * Connects to the nats server, and subscribes to trainer events
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
    this.serviceHbInterval = setInterval(this.sendHeartbeat.bind(this), poke.POKENATS_SERVICE_HB_INTERVAL);
    this.sendHeartbeat();
  }).bind(this))
  nc.on('connect', (function() {
    this.nc.subscribe(poke.POKENATS_ADMIN_REQUEST, this.forwardAdminRequest.bind(this));
  }).bind(this));
};

BaseService.prototype.forwardAdminRequest = function(msg, reply, subject) {
  try {
    var m = JSON.parse(msg);
    if(!m.op || !m.client) {
      this.badRequest({msg: msg, subject: subject, err: 'Missing required fields'});
      return;
    }
    if(m.client === '*' || m.client === this.opts.client) {
      if(poke.PROCESS_KILL_PROP === m.op) {
        this.loginfo('Process shutting down because of remote admin request.');
        this.close();
        process.exit(1);
      } else if(poke.PROCESS_DISCOVERY_PROP === m.op) {
        this.nc.publish(reply, JSON.stringify({client: this.opts.client, serviceType: this.opts.serviceType}));
        this.loginfo('Responded to process discovery request.');
      } else {
        // this is for client specific usage
        this.emit('admin-request', m);
      }
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
 * Closes the connection to the nats server.
 */
BaseService.prototype.close = function() {
  if(! this.isClosed()) {
    var nc = this.nc;
    this.emit('closing', nc);
    delete this['nc'];
    nc.flush(function(err) {
      if(err) {
        this.logerror(err);
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
  this.logerror('[P] ' + subject + ': ' + m);
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

BaseService.prototype.logerror = function() {
  var args = [];
  var subj = errorSubject(this.opts.client, this.opts.serviceType);
  args.push(subj);
  for(var i=0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  log.apply(this, args);
};

BaseService.prototype.loginfo = function() {
  var args = [];
  var subj = infoSubject(this.opts.client, this.opts.serviceType);
  args.push(subj);
  for(var i=0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  log.apply(this, args);
};

BaseService.prototype.sendHeartbeat = function() {
  if(this.nc) {
    this.nc.publish(monitoringSubject(this.opts.serviceType, this.opts.client));
  }
};

function subjectBase(subject, serviceType, clientID) {
  clientID = clientID || 'unknown_client';
  serviceType = serviceType || 'unknown_service';
  return subject + '.' + serviceType + '.' + clientID;
}
exports.subjectBase = subjectBase;


function infoSubject(serviceType, clientID) {
  return subjectBase(poke.POKENATS_LOG, serviceType, clientID) + '.' + poke.INFO;
}
exports.infoSubject = infoSubject;

function errorSubject(serviceType, clientID) {
  return subjectBase(poke.POKENATS_LOG, serviceType, clientID) + '.' + poke.ERROR;
}
exports.errorSubject = errorSubject;

function monitoringSubject(serviceType, clientID) {
  return exports.subjectBase(poke.POKENATS_MONITORING, serviceType, clientID);
}
exports.monitoringSubject = monitoringSubject;
