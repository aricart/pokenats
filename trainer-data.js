/* jslint node: true */

'use-strict';

var path = require('path'),
 base = require('./lib/BaseService'),
 tds = require('./lib/DataService'),
 poke = require('./lib/Common'),
 nuid = require('nuid');

var args = process.argv.slice(2);
var queue_group = getFlagValue('-q') || undefined;
var client_id = getFlagValue('-id') || nuid.next();
var server = getFlagValue('-s') || undefined;
var dir = getFlagValue('-d') || __dirname;

function getFlagValue(k) {
  var i = args.indexOf(k);
  if (i > -1) {
    var v = args[i + 1];
    args.splice(i, 2);
    return v;
  }
}

console.log('PokéNATS Trainer Data Service');
// directory for persistent data
var opts = {serviceType: 'trainer-data'};
opts.dir = path.resolve(dir, 'trainer-data');
console.log('Using dir [' + opts.dir + '] for trainer-data.');

if(client_id) {
  opts.client = client_id;
  console.log('Using client id: [' + client_id + ']');
}

if(server) {
  opts.server = server;
  console.log('Connecting to server(s): [' + server + ']');
}

if(queue_group){
  opts.queue = queue_group;
  console.log('Processing requests as part of queue group [' + queue_group + ']');
}

var ts = new tds.TrainerDataService(opts);
ts.connect();
ts.on('connect', function() {
  console.log('Connected.');
  console.log('Monitoring on [' + base.monitoringSubject(opts.serviceType, opts.client) + ']');
  console.log('Logging on [' + base.subjectBase(poke.POKENATS_LOG, opts.serviceType, opts.client) + ']');
});

ts.on('error', function(error) {
  console.log(error);
});











