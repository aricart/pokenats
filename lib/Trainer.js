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
  var m = JSON.stringify(msg);
  if(! this.nc) {
    this.logerror('[E!] Trainer#getTrainerData failed. Connection is closed.');
    return;
  }
  this.loginfo('[R>] ' + poke.TRAINER_DATA_REQ + ': ' + m);
  this.nc.request(poke.TRAINER_DATA_REQ, m, {max:1}, (function(reply) {
    var data = JSON.parse(reply);
    if(data && data.inventory && data.client) {
      this.loginfo('[>R] ' + poke.TRAINER_DATA_REQ + ': ' + reply);
      this.world = data;
      this.opts.client = data.client;
      this.emit('ready');
    }
  }).bind(this));
};

/**
 * Gets a hearbeat from one of the nearby quadrants
 * @param msg
 */
Trainer.prototype.handleHeartbeat = function(msg, reply, subj) {
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
      this.loginfo('Initiating Genesis!');
      this.consume();
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

Trainer.prototype.handleGenesis = function(msg, reply, subj, sid) {
  this.loginfo('[M] ' + subj + ': ' + msg);
  try{
    var m = JSON.parse(msg);
    this.emit('genesis', m);
  } catch(err) {
    this.badRequest({msg: msg, subj: subj, err: err.message});
  }
};

function makeSubject(base, grid) {
  return base + '.' + grid.index;
}

Trainer.prototype.updateGeoEvents = function() {
  if(this.nc) {
    var nc = this.nc;
    var newSubs = {};

    if (this.grid) {
      var subject = makeSubject(poke.POKENATS_GENESIS, this.grid);
      var ssid;

      // Only subscribe to a geo event if we are not already subscribing to it.
      if (!this.geoSubIds[subject]) {
        ssid = nc.subscribe(subject, this.handleGenesis.bind(this));
      }
      newSubs[ssid] = subject;

      // we subscribe events from all adjacent quadrants for heartbeats
      var subGrids = [];
      for (var x = -1; x < 2; x++) {
        for (var y = -1; y < 2; y++) {
          var grid = this.grid.relative(x, y);
          subject = makeSubject(poke.TRAINER_UPDATE, grid);
          if (!this.geoSubIds[subject]) {
            ssid = nc.subscribe(subject, this.handleHeartbeat.bind(this));
            subGrids.push(grid.index);
          }
          newSubs[ssid] = subject;
        }
      }
      this.loginfo('[S] ' + poke.TRAINER_UPDATE + ': [' + subGrids.join() + ']');
    }
    // unsubscribe the previous geo events
    var unsubGrids = [];
    for (var n in this.geoSubIds) {
      if (!newSubs[n]) {
        var subj = this.geoSubIds[n];
        nc.unsubscribe(n);
        unsubGrids.push(subj.substring(subj.lastIndexOf('.') + 1));
      }
    }
    this.loginfo('[U] ' + poke.TRAINER_UPDATE + ': [' + unsubGrids.join() + ']');
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
        this.loginfo('Updated trainer heartbeat interval to ' + v);
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
        var s = makeSubject(poke.TRAINER_UPDATE, g);
        this.nc.publish(s, m, function(err) {
          if(err) {
            this.logerr('Got an error publishing heartbeats: ' + err);
            this.reset();
          }
        });
      }
    }
    this.loginfo('[P] ' + poke.TRAINER_UPDATE + ' to [' + grids.join() + '] : ' + m);
  }
};

Trainer.prototype.reset = function() {
  this.close();
  this.connect();
};

Trainer.prototype.consume = function() {
  this.energy -= 100;
  var m = JSON.stringify({client: this.opts.client, location: this.grid.gps});
  this.nc.publish(poke.TRAINER_GENESIS, m);
};




