/* jslint node: true */

'use-strict';

var path = require('path'),
poke = require('./lib/Common'),
trainer = require('./lib/Trainer'),
nuid = require('nuid'),
nats = require('nats');

console.log('PokéNATS Populator');

var nc = nats.connect();
var registry = {};

function count(o) {
  var k, c = 0;
  for(k in o) {
    if(o.hasOwnProperty(k)) {
      c++;
    }
  }
  return c;
}

function prune() {
  var i, k, r, t, g, opts, pop, rpop, tpop, status;
  for(k in registry) {
    if(registry.hasOwnProperty(k)) {
      status = registry[k];
      pop = count(status.clients);
      rpop = count(status.robots);
      tpop = rpop + pop;
      if(tpop < 3) {
        g = parseInt(k);
        var grid = poke.gridFromIndex(g);
        for(i=tpop; i < 3; i++) {
          opts = {client: 'robot_' + nuid.next(), location:{lng: grid.gps.lng, lat: grid.gps.lat}};
          t = new trainer.Trainer(opts);
          t.connect();
          status.robots[opts.client] = t;
          console.log('Created robot: ' + opts.client + ' at grid: ' + g);
        }
      }
      else if(pop > 3) {
        if(count(status.robots) > 0) {
          for(r in status.robots) {
            console.log('Killing robot: ' + r);
            t = status.robots[r];
            t.close();
            delete status.robots[r];
          }
        }
      }
    }
  }
}

setTimeout(prune, 5*1000);

nc.on('connect', function(nc) {
  nc.subscribe(poke.POKENATS + '.trainer.*.update.>', function(msg, reply, subject) {
    console.log(msg);
    var chunks = subject.split('.');
    var clientID = chunks[2];
    if(clientID.startsWith('robot_')) {
      console.log('Ignoring hb from robot');
      return;
    }

    var grid = chunks[4];
    if(grid) {
      var status = registry[grid];
      if(! status) {
        status = {robots:{}, clients:{}};
        registry[grid] = status;
      }
      status.clients[clientID] = Date.now();
    }
  });
});










