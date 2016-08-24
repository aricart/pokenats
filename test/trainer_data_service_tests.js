/**
 * Created by albertoricart on 8/12/16.
 */

/* jslint node: true */
/* global describe: false, before: false, after: false, it: false */
'use strict';

var poke = require('../lib/common.js'),
nats = require('nats'),
nuid = require('nuid'),
nsc = require('./support/nats_server_control'),
should = require('should'),
tds = require('../lib/DataService'),
trainer = require('../lib/Trainer'),
eden = require('../lib/Eden'),
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
      var id = nuid.next();
      var subj = poke.makeSubject(poke.POKENATS, 'trainer', id, 'data');
      ts.nc.request(subj, JSON.stringify(m), {max:1}, function(msg) {
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
      var id = '6QXNM4EVHHZ18C3TEUZHK3';
      var subj = poke.makeSubject(poke.POKENATS, 'trainer', id, 'data');
      var m = {client: id};
      ts.nc.request(subj, JSON.stringify(m), {max: 1}, function (msg) {
        msg = JSON.parse(msg);
        should.exist(msg.client);
        should.exist(msg.inventory);
        ts.close();
        done();
      });
    });
    ts.connect();
  });

  it('trainer should close', function(done) {
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
