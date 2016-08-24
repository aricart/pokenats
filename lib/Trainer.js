/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
poke = require('./Common'),
fs = require('fs'),
path = require('path'),
util = require('util'),
base = require('./BaseService');



function Trainer(opts) {
  this.init(opts);
  this.geoSubIds = {};
  this.energy = 0;
  this.world = {};
  this.updateLocation(opts.location);
  this.heartbeatInterval = poke.TRAINER_HB_INTERVAL;

  this.on('connect', this.getTrainerData.bind(this));
  this.on('ready', this.enter.bind(this));
  this.on('closing', this.exit.bind(this));
  this.on('admin-request', this.handleAdminRequest.bind(this));

  return this;
}

exports.Trainer = Trainer;
util.inherits(Trainer, base.BaseService);


Trainer.prototype.getTrainerData = function() {
  var msg = {};

  if(this.opts.client) {
    msg.client = this.opts.client;
  }
  if(this.opts.emailHash) {
    msg.emailHash = this.opts.emailHash;
  }

  var m = JSON.stringify(msg);
  if(! this.nc) {
    this.logError('[E!] Trainer#getTrainerData failed. Connection is closed.');
    return;
  }

  var subj = poke.makeSubject(poke.POKENATS, 'trainer', this.opts.client, 'data');
  this.logInfo('[R>] ' + subj+ ': ' + m);
  this.nc.request(subj, m, {max:1}, (function(reply) {
    var data = JSON.parse(reply);
    if(data && data.inventory && data.client) {
      this.logInfo('[>R] ' + subj + ': ' + reply);
      this.world = data;
      this.opts.client = data.client;
      if(data.emailHash) {
        this.opts.emailHash = data.emailHash;
      }
      this.emit('ready');
    }
  }).bind(this));
};

/**
 * Gets a hearbeat from one of the nearby quadrants
 * @param msg
 */
Trainer.prototype.handleUpdate = function(msg, reply, subj) {
  try {
    msg = JSON.parse(msg);
    if(! msg.client) {
      this.badRequest({msg: msg, subj: subj, err: 'No client in heartbeat request'});
      return;
    }

    // is this is our own heartbeat?
    if(msg.client === this.opts.client) {
      return;
    }

    if(!msg.location) {
      this.badRequest({msg: msg, subj: subj, err: 'No location in request'});
      return;
    }

    // we get possibly 9 events from this, reduce them
    // var distance = poke.distance(this.opts.location, msg.location);
    var distance = poke.distance(msg.location.lat, msg.location.lng, this.opts.location.lat, this.opts.location.lng);
    this.energy += (1/distance^2) / 9;

    if(this.energy >= 100) {
      this.triggerSpawn();
    }

    this.emit('energy', this.energy);

  } catch(err) {
    this.badRequest({msg: msg, subj: subj, err: err});
  }
};

Trainer.prototype.updateLocation = function(location) {
  this.opts.location = location;
  this.grid = new poke.Grid(location);
  this.updateGeoEvents();
};

Trainer.prototype.handleNew = function(msg, reply, subj, sid) {
  // ignore trainer generated events
  var a = subj.split('.');
  if(a[1] === this.opts.serviceType) {
    return;
  }
  this.logInfo('[M] ' + subj + ': ' + msg);
  try{
    var m = JSON.parse(msg);
    this.emit('genesis', m);
  } catch(err) {
    this.badRequest({msg: msg, subj: subj, err: err.message});
  }
};

Trainer.prototype.updateGeoEvents = function() {
  if(this.nc) {
    var nc = this.nc;
    var newSubs = {};

    if (this.grid) {
      var subject = poke.makeSubject(poke.POKENATS, '*', '*', poke.NEW, this.grid.index);
      var ssid;

      // Only subscribe to a geo event if we are not already subscribing to it.
      if (!this.geoSubIds[subject]) {
        ssid = nc.subscribe(subject, this.handleNew.bind(this));
      }
      newSubs[ssid] = subject;

      // we subscribe events from all adjacent quadrants for heartbeats
      var subGrids = [];
      for (var x = -1; x < 2; x++) {
        for (var y = -1; y < 2; y++) {
          var grid = this.grid.relative(x, y);
          subject = poke.makeSubject(poke.POKENATS, this.opts.serviceType, '*', poke.UPDATE, grid.index);
          if (!this.geoSubIds[subject]) {
            ssid = nc.subscribe(subject, this.handleUpdate.bind(this));
            subGrids.push(grid.index);
          }
          newSubs[ssid] = subject;
        }
      }
      this.logInfo('[S] ' + poke.makeSubject(poke.POKENATS, this.opts.serviceType, '*', poke.UPDATE) + ': [' + subGrids.join() + ']');
    }
    // unsubscribe the previous geo events
    var unsubGrids = [];
    for (var n in this.geoSubIds) {
      if (this.geoSubIds.hasOwnProperty(n)) {
        if (!newSubs[n]) {
          var subj = this.geoSubIds[n];
          nc.unsubscribe(n);
          unsubGrids.push(subj.substring(subj.lastIndexOf('.') + 1));
        }
      }
    }
    this.logInfo('[U] ' + poke.makeSubject(poke.POKENATS, this.opts.serviceType, '*', poke.UPDATE) + '[' + unsubGrids.join() + ']');
    this.geoSubIds = newSubs;
  }
};

Trainer.prototype.handleAdminRequest = function(m) {
  var v;
  if(poke.TRAINER_HB_INTERVAL_PROP === m.op) {
    v = parseInt(m.opValue);
    if(v > 500) {
      this.heartbeatInterval = v;
      if(this.sendUpdate) {
        this.logInfo('Updated trainer heartbeat interval to ' + v);
        clearInterval(this.sendUpdate);
      }
      this.enter();
    }
  }
};

Trainer.prototype.enter = function() {
  // start heartbeating
  this.sendUpdate = setInterval(this.sendUpdate.bind(this), this.heartbeatInterval);
  this.updateGeoEvents();
};

Trainer.prototype.exit = function() {
  if(this.sendUpdate) {
    clearInterval(this.sendUpdate);
  }
  delete this['grid'];
  this.updateGeoEvents();
};

Trainer.prototype.sendUpdate = function() {
  // var that = this;
  if(this.nc && this.grid) {
    var msg = {location: this.grid.gps, client: this.opts.client };
    var m = JSON.stringify(msg);
    var grids = [];

    for(var x=-1; x < 2; x++) {
      for(var y=-1; y < 2; y++) {
        var g = this.grid.relative(x,y);
        grids.push(g.index);
        var s = poke.makeSubject(poke.POKENATS, this.opts.serviceType, this.opts.client, poke.UPDATE, g.index);
        this.nc.publish(s, m, function(err) {
          if(err) {
            this.logerr('Got an error publishing update: ' + err);
            this.reset();
          }
        });
      }
    }
    this.logInfo('[P] ' + poke.makeSubject(poke.POKENATS, this.opts.serviceType, this.opts.client, poke.UPDATE) + ' to [' + grids.join() + '] : ' + m);
  }
};

Trainer.prototype.reset = function() {
  this.close();
  this.connect();
};

Trainer.prototype.triggerSpawn = function() {
  this.energy -= 100;
  var subject = poke.makeSubject(poke.POKENATS, this.opts.serviceType, this.opts.client, poke.SPAWN, this.grid.index);
  var m = JSON.stringify({client: this.opts.client, location: this.grid.gps});
  this.logInfo('[P] ' + subject + ': ' + m);
  this.nc.publish(subject, m);
};




