/**
 * Created by albertoricart on 8/12/16.
 */

/* jslint node: true */
/* global describe: false, before: false, after: false, it: false */
'use strict';

var poke = require('../lib/common.js'),
eden = require('../lib/Eden.js'),
nats = require('nats'),
nsc = require('./support/nats_server_control'),
should = require('should'),
nuid = require('nuid');

describe('Genesis', function() {

  var PORT = 4222;
  var server;

  // Start up our own nats-server
  before(function(done) {
    server = nsc.start_server(PORT, done);
  });

  // Shutdown our server
  after(function() {
    server.kill();
  });


  it('should respond with new genesis', function(done) {
    var grid = new poke.Grid({lat: 0, lng: 0});
    var es = new eden.Eden({});
    es.on('ready', function() {
      var nc = nats.connect(PORT);
      nc.on('connect', function () {
        var ssid = nc.subscribe(poke.POKENATS_GENESIS + '.' + grid.index, function (msg) {
          var m = JSON.parse(msg);
          should.exist(m.location);
          should.exist(m.id);
          should.exist(m.dob);
          should.exist(m.name);
          should.exist(m.level);
          nc.unsubscribe(ssid);
          nc.close();
          es.close();
          done();
        });
      });
      var req = {client: nuid.next(), location: grid.gps};
      nc.publish(poke.TRAINER_GENESIS, JSON.stringify(req));
    });
    es.connect();
  });
});