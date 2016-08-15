/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
poke = require('./Common'),
util = require('util'),
base = require('./BaseService'),
STAN = require('node-nats-streaming');

function EdenService(opts) {
  // encoding for stan must be binary.
  opts.encoding = 'binary';
  this.init(opts);
  this.on('connect', this.handleConnect.bind(this));
  this.on('close', this.handleClose.bind(this));
}

exports.Eden = EdenService;
util.inherits(EdenService, base.BaseService);

EdenService.prototype.handleGenesis = function(m) {
  if(!m) {
    this.badRequest({msg: m, subj: poke.TRAINER_GENESIS, err: 'No message payload.'});
  }
  try {
    var msg = JSON.parse(m);
    if(!msg || !msg.client || !msg.location) {
      this.badRequest({msg: msg, subj: poke.TRAINER_GENESIS, err: 'Missing required fields.'});
    } else {
      var grid = poke.Grid(msg.location);
      var pm = this.create(msg.location);
      var subject = poke.POKENATS_GENESIS + '.' + grid.index;
      var data = JSON.stringify(pm);

      // send to active trainers
      this.nc.publish(subject, data);
      this.loginfo('[P] ' + subject + ': ' + data);

      if(this.sc) {
        // send to the streaming server
        this.loginfo('[SP] ' + subject + ': ' + data);
        this.sc.publish(subject, data);
      }
    }
  } catch(err) {
    this.badRequest({msg: m, subj: poke.TRAINER_GENESIS, err: 'Error parsing: ' + err});
  }
};


function pointInRadius(origin, radius) {
  // 5th decimal digit is about 1.1m
  var r = radius / 1000000;
  // value range from 0 to 360 rad
  var rad360 = 360 * (Math.PI / 180);
  var a = Math.random() * rad360;
  // calculate x, y for the random point
  var x = origin.lng + r * Math.cos(a);
  var y = origin.lat + r * Math.sin(a);
  return {lng: x, lat: y};
}


EdenService.prototype.create = function(where) {
  var names = ['N', 'A', 'T', 'S'];
  var retVal = {};

  // spawn it within a 500m radius
  var radius = Math.random() * 5000;
  retVal.location = pointInRadius(where, radius);

  retVal.id = nuid.next();
  retVal.dob = Date.now();
  retVal.name = names[Math.floor((Math.random()*names.length))];
  retVal.level = Math.floor(Math.random()*100 + 1);
  if(Math.floor(Math.random*1) === 1) {
    retVal.level += level;
  }
  return retVal;
};

EdenService.prototype.handleConnect = function(nc) {
  // we use a NATS connection to read genesis events. Queues used to distribute the
  // processing of incoming data
  var queueGroup = this.opts.queue || '';
  this.genensisSID = nc.subscribe(poke.TRAINER_GENESIS, queueGroup, this.handleGenesis.bind(this));
  this.loginfo('[S] ' + poke.TRAINER_GENESIS + '[' + queueGroup +']');

  // in order to snapshot the world, we also broadcast the event
  // on a more particular channel to the streaming server
  // the streaming server will provide memory for new clients
  // joining.
  if(this.opts.streaming) {
    this.opts.nc = nc;
    var sc = STAN.connect(this.opts.clusterID, this.opts.client, this.opts);
    sc.on('connect', (function () {
      this.sc = sc;
      this.monitor();
      this.emit('ready');
    }).bind(this));
  } else {
    this.emit('ready');
  }
};

EdenService.prototype.handleClose = function(nc) {
  nc.unsubscribe(this.genensisSID);
  if(this.opts.streaming) {
    this.sc.close();
  }
};

