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

console.log('PokéNATS Counter');

var opts = {serviceType: 'trainer-counter'};
if(uri) {
  opts.uri = uri;
  console.log('Connecting to server(s): [' + uri + ']');
}

if(process.env.NATS_URI) {
  opts.uri = process.env.NATS_URI;
  console.log('Connecting to server(s): [' + uri + ']');
}

var tracking = {N:0, A:0, T:0, S:0};
var nats = NATS.connect(opts);
nats.on('connect', function(nc) {
  nc.subscribe('pokenats.eden-service.*.new.>', function(msg, reply, subject) {
    var pn = JSON.parse(msg);
    tracking[pn.name]++;
  });

  setInterval(function() {
    process.stdout.write('N[' + tracking.N + '] A[' + tracking.A + '] T[' + tracking.T + '] S[' + tracking.S + ']\r');
  })
});











