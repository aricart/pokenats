/* jslint node: true */

'use-strict';

var path = require('path'),
poke = require('./lib/Common'),
base = require('./lib/BaseService'),
nuid = require('nuid');
trainer = require('./lib/Trainer.js');

var args = process.argv.slice(2);
var client_id = getFlagValue('-id') || nuid.next();
var server = getFlagValue('-s') || undefined;
var lat = getFlagValue('-lat') || undefined;
var lng = getFlagValue('-lng') || undefined;

function getFlagValue(k) {
  var i = args.indexOf(k);
  if (i > -1) {
    var v = args[i + 1];
    args.splice(i, 2);
    return v;
  }
}

console.log('PokéNATS Trainer');
// directory for persistent data
var opts = {serviceType: 'trainer'};

if (client_id) {
  opts.client = client_id;
  console.log('Using client id: [' + client_id + ']');
}

if (server) {
  opts.server = server;
  console.log('Connecting to server(s): [' + server + ']');
}

if (lat && lng) {
  var location = {lat: lat, lng: lng};
  opts.location = location;
}

var ts = new trainer.Trainer(opts);
ts.connect();
ts.on('connect', function () {
  console.log('Connected.');
  console.log('Monitoring on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.HB) + ']');
  console.log('Logging on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.LOG, '*') + ']');
});

ts.on('error', function (error) {
  console.log(error);
  process.exit(1);
});











