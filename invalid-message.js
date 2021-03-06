/* jslint node: true */

'use-strict';

/**
 * This service implements the messaging pattern called 'Invalid Message Channel'.
 * The content of the message is a JSON object:
 * <code>
 *   {
 *    msg:theOriginalMessage,
 *    subject: the subject the message was received on
 *    inbox: the inbox, if any where the sender expected a reply (if request reply).
 *   }
 * </code>
 *
 * When a pokénats service receives a message in a subject but it ran into an error,
 * it publishes a message on the subject <code>_pokenats._bad</code>. The
 * Pokénats invalid service listens for these messages and captures them.
 *
 * This enables issues in the distributed application to become visible
 *
 * @type {*}
 */

const NATS = require('nats'),
poke = require('./lib/Common'),
util = require('util'),
nuid = require('nuid'),
events = require('events'),
invalid = require('./lib/InvalidMessageService'),
base = require('./lib/BaseService');

var args = process.argv.slice(2);
var queue_group = getFlagValue('-q') || '';
var client_id = getFlagValue('-id') || nuid.next();
var uri = getFlagValue('-s') || undefined;

function getFlagValue(k) {
  var i = args.indexOf(k);
  if (i > -1) {
    var v = args[i + 1];
    args.splice(i, 2);
    return v;
  }
}

console.log('PokéNATS Invalid Message Service');
var opts = {serviceType: 'invalid-message'};
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

var is = new invalid.InvalidMessageService(opts);
is.on('connect', function(){
  console.log('Connected.');
  console.log('Monitoring on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.HB) + ']');
  console.log('Logging on [' + poke.makeSubject(poke.POKENATS, opts.serviceType, opts.client, poke.LOG, '*') + ']');
});
is.on('error', function(error) {
  console.log(error);
  process.exit(1);
});
is.connect();








