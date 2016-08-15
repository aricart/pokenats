/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
nats = require('nats'),
poke = require('./Common'),
util = require('util'),
events = require('events'),
base = require('./BaseService');

function InvalidMessageService(opts) {
  this.opts = opts;
  events.EventEmitter.call(this);

  this.on('connect', (function(nc){
    var queue = this.opts.queue || '';
    var subOpts = {queue: queue};
    this.nc.subscribe(poke.BAD_REQ, subOpts, this.handleMessage.bind(this));
    this.loginfo('[S] ' + poke.BAD_REQ + '[' + subOpts.queue + ']');
  }).bind(this));

  return this;
}
exports.InvalidMessageService = InvalidMessageService;
util.inherits(InvalidMessageService, base.BaseService);


InvalidMessageService.prototype.handleMessage = function(msg) {
  // this handler is very simple, we just print a message to stdout
  if(typeof msg === 'object') {
    msg = JSON.stringify(msg);
  }
  console.error(Date.now() + ': ' + msg);
  this.emit('invalid', msg);
};

