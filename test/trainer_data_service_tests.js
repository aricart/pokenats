/**
 * Created by albertoricart on 8/12/16.
 */

/* jslint node: true */
/* global describe: false, before: false, after: false, it: false */
'use strict';

var poke = require('../lib/common.js'),
nats = require('nats'),
nsc = require('./support/nats_server_control'),
should = require('should'),
tds = require('../lib/DataService'),
trainer = require('../lib/Trainer'),
path = require('path');

describe('Basics', function() {

  var PORT = 4222;
  var server;
  var dataDir =  path.resolve(__dirname, 'trainer-data');

  // Start up our own nats-server
  before(function(done) {
    server = nsc.start_server(PORT, done);
  });

  // Shutdown our server
  after(function() {
    server.kill();
  });


  it('should respond with new data request', function(done) {
    var ts = new tds.TrainerDataService({dir: dataDir});
    ts.on('ready', function() {
      var m = {};
      ts.nc.request(poke.TRAINER_DATA_REQ, JSON.stringify(m), {max:1}, function(msg) {
        msg = JSON.parse(msg);
        should.exist(msg.client);
        should.exist(msg.inventory);
        ts.close();
        done();
      });
    });
    ts.connect();
  });

  it('should respond to trainer data request', function(done) {
    var ts = new tds.TrainerDataService({dir: dataDir});
    ts.on('ready', function () {
      var m = {client: '6QXNM4EVHHZ18C3TEUZHK3'};
      ts.nc.request(poke.TRAINER_DATA_REQ, JSON.stringify(m), {max: 1}, function (msg) {
        msg = JSON.parse(msg);
        should.exist(msg.client);
        should.exist(msg.inventory);
        ts.close();
        done();
      });
    });
    ts.connect();
  });

  it('trainer shoiuld close', function(done) {
    var ts = new tds.TrainerDataService({dir: dataDir});
    ts.on('ready', function () {
      var t = new trainer.Trainer({});
      t.on('ready', function() {
        t.close();
        done();
      });
      t.connect();
      });
    ts.connect();
  });
});
