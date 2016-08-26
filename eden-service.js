/* jslint node: true */

'use-strict';

var path = require('path'),
 nuid = require('nuid'),
 base = require('./lib/BaseService'),
 poke = require('./lib/Common'),
 eden = require('./lib/Eden');

var args = process.argv.slice(2);
var client_id = getFlagValue('-id') || nuid.next();
var cluster_id = getFlagValue('-cluster') || 'test-cluster';
var uri = getFlagValue('-s') || undefined;
var queue_group = getFlagValue('-q') || undefined;
var stream = getFlagValue('-stream') || false;

function getFlagValue(k) {
  var i = args.indexOf(k);
  if (i > -1) {
    var v = args[i + 1];
    args.splice(i, 2);
    return v;
  }
}

console.log('PokéNATS EdenService Service');

var opts = {serviceType: 'eden-service'};
if(client_id) {
  opts.client = client_id;
  console.log('Using client id: [' + client_id + ']');
}

if(uri) {
  opts.uri = uri;
  console.log('Connecting to server(s): [' + uri + ']');
}

if(process.env.NATS_URI) {
  opts.uri = process.env.NATS_URI;
  console.log('Connecting to server(s): [' + uri + ']');
}

if(queue_group) {
  opts.queue = queue_group;
  console.log('Processing requests as part of queue group [' + queue_group + ']');
}

if(stream) {
  opts.streaming = stream;
  opts.clusterID = cluster_id;
  console.log('Processing will send to NATS streaming server [' + cluster_id + ']');
}

var es = new eden.Eden(opts);
es.connect();
es.on('connect', function() {
  console.log('Connected.');
  console.log('Monitoring on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.HB) + ']');
  console.log('Logging on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.LOG, '*') + ']');
});

es.on('error', function(error) {
  console.log(error);
  process.exit(1);
});











