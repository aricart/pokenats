/* jslint node: true */

'use-strict';

var nuid = require('nuid'),
nats = require('nats'),
poke = require('./Common'),
fs = require('fs'),
path = require('path'),
util = require('util'),
events = require('events'),
base = require('./BaseService');

function TrainerDataService(opts) {
  this.init(opts);
  if(! opts.dir) {
    console.error("Directory for data is not specified. Bailing.");
    process.exit(1);
  }

  this.on('connect', (function(nc) {
    nc.subscribe(poke.TRAINER_DATA_REQ, this.opts.queue, this.handleTrainerDataRequest.bind(this));
    var m = 'Subscribing to [' + poke.TRAINER_DATA_REQ + ']';
    console.log(m);
    this.loginfo(m);
    this.emit('ready');
  }).bind(this));

  fs.exists(opts.dir, (function(exists) {
    if(! exists) {
      fs.mkdir(opts.dir, function(err) {
        if(err) {
          console.error('Error creating [' + err.message + ']. Bailing.');
          this.emit('error', err);
          process.exit(1);
        }
      })
    }
  }).bind(this));
  return this;
}

exports.TrainerDataService = TrainerDataService;
util.inherits(TrainerDataService, base.BaseService);



TrainerDataService.prototype.load = function(msg, callback) {
  var data = {};
  data.client = msg.client || nuid.next();
  data.emailHash = msg.emailHash || undefined;
  data.inventory = {};

  var file = path.resolve(this.opts.dir, data.client + '.json');
  fs.exists(file, function(exists) {
    if(! exists) {
      var bytes = JSON.stringify(data);
      fs.writeFile(file, bytes, function (err) {
        if(err) {
          var m = 'Error writing: ' + file + ': ' + err;
          console.log(m);
          this.logerror(m);
        }
        callback(err, bytes);
      });
    } else {
      fs.readFile(file, 'utf8', function(err, data) {
        callback(err, data);
      });
    }
  });
};

/**
 * Handles requests for trainer data
 * @param msg
 * @param inbox
 * @param subj
 * @param sid
 */
TrainerDataService.prototype.handleTrainerDataRequest = function(msg, inbox, subj) {
  inbox = inbox || '';
  subj = subj || '';

  // check that the input looks reasonable
  try {
    if(arguments.length < 3 || subj.length < 1 || inbox.length < 1) {
      throw new Error('missing arguments.');
    }
    msg = JSON.parse(msg);
    if(typeof msg !== 'object') {
      throw new Error('bad JSON');
    }
  } catch (err) {
    this.badRequest({msg: msg, subj: subj, inbox: inbox, err: err.message});
    return;
  }

  this.load(msg, (function(err, data) {
    if(err) {
      console.log(err);
    } else {
      this.nc.publish(inbox, data);
    }
  }).bind(this));
};


