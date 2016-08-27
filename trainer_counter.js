/* jslint node: true */

'use-strict';

var path = require('path'),
poke = require('./lib/Common'),
base = require('./lib/BaseService'),
nuid = require('nuid'),
NATS = require('nats');

var args = process.argv.slice(2);
var uri = getFlagValue('-s') || undefined;

function getFlagValue(k) {
  var i = args.indexOf(k);
  if (i > -1) {
    var v = args[i + 1];
    args.splice(i, 2);
    return v;
  }
}

console.log('PokéNATS Trainer Counter');

var opts = {serviceType: 'trainer-counter'};
if(uri) {
  opts.uri = uri;
  console.log('Connecting to server(s): [' + uri + ']');
}

if(process.env.NATS_URI) {
  opts.uri = process.env.NATS_URI;
  console.log('Connecting to server(s): [' + uri + ']');
}

var tracking = {};
var nats = NATS.connect(opts);
nats.on('connect', function(nc) {
  nc.subscribe('pokenats.trainer.*.update.*', function(msg, reply, subject) {
    var id = subject.split('.')[2];
    tracking[id] = {lastSeen: Date.now()};
  });

  setInterval(function() {
    var now = Date.now() - 10000;
    var counts = 0;

    for(k in tracking) {
      if(tracking.hasOwnProperty(k)){
        var s = tracking[k];
        if(s.lastSeen > now) {
          counts++;
        } else {
          delete tracking[k];
        }
      }
    }
    process.stdout.write('Found ' + counts + ' clients.\r');
  })
});











