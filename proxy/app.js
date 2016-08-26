var express = require('express'),
cookieParser = require('cookie-parser'),
bodyParser = require('body-parser'),
path = require('path'),
app = express(),
fs = require('fs'),
crypto = require('crypto'),
trainer = require('../lib/Trainer'),
nuid = require('nuid'),
nats = require('nats');

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// This gateway will never scale. Simply here for a test.
var trainers = {};

app.use(bodyParser());
app.use('lib', express.static('../lib'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// prune connections that
setInterval(function() {
  var old = Date.now() - 5 * 60 * 1000;
  for(var id in trainers) {
    var t = trainers[id];
    if(t.last < old) {
      try {
        t.trainer.close();
        console.log('Pruning ' + id + ' due to inactivity.')
      } catch(err) {
      }
      delete trainers[id];
    }
  }
}, 60*1000);


var nc;

app.all('/', function(req, res){
  var id = req.cookies.trainerID;
  var emailHash = req.cookies.emailHash;

  if(!id || !emailHash) {
    res.redirect('/login.html');
  } else {
    res.redirect('/map.html');
  }
});

app.all('/register', function(req, res) {
  var trainerID = req.cookies.trainerID || nuid.next();
  var email = req.body.email || req.query.email;
  var emailHash = crypto.createHash('md5').update(email).digest('hex').toLowerCase();
  var opts = {client:trainerID, emailHash: emailHash};
  if(process.env.NATS_URI) {
    opts.uri = process.env.NATS_URI;
  }
  var t = new trainer.Trainer(opts);
  t.on('ready', function() {
    res.cookie('trainerID', t.opts.client, {maxAge: 60*60*1000});
    res.cookie('trainerIcon', t.opts.emailHash, {maxAge: 60*60*1000});
    res.redirect('/map.html');
    t.close();
  });
  t.connect();
});


app.all('/trainer/lat/:lat/lng/:lng', function(req, res) {
  if(! req.cookies.trainerID || ! req.cookies.trainerIcon) {
    res.redirect('/login.html');
    res.send();
    return;
  }

  var opts = {location:{lat: parseFloat(req.params.lat), lng: parseFloat(req.params.lng)}, serviceType: 'trainer'};
  if(process.env.NATS_URI) {
    opts.uri = process.env.NATS_URI;
  }
  var trainerID = req.cookies.trainerID || nuid.next();
  var emailHash = req.cookies.emailHash;

  var e;
  var t;
  if(trainerID) {
    opts.client = trainerID;
    opts.emailHash = emailHash;
    e = trainers[trainerID];
    if(e && e.trainer) {
      t = e.trainer;
    }
  }
  if(! e) {
    e = {genesis:[], energy:0};
  }


  var done = function(t) {
    var id = t.opts.client;
    res.cookie('trainerID', id, {maxAge: 60*60*1000});
    if(e.emailHash) {
      res.cookie('trainerIcon', e.emailHash, {maxAge: 60*60*1000});
    }
    res.status(200);
    res.set('Content-Type', 'application/json');
    e.last = Date.now();
    trainers[id] = e;
    var d = {genesis: e.genesis, energy: e.energy, id: id};
    e.genesis = [];
    res.send(JSON.stringify(d));
  };

  if(t) {
    t.updateLocation(opts.location);
    // console.log('/trainer/new: already running ' + t.opts.cookie);
    done(t);
  } else {
    t = new trainer.Trainer(opts);
    e.trainer = t;
    t.on('ready', function() {
      // console.log('/trainer/new: added ' + t.opts.cookie);
      done(t);
    });
    t.on('genesis', function(msg) {
      e.genesis.push(msg);
    });
    t.on('energy', function(n) {
      e.energy = n;
    });
    t.connect();
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.send(err.status);
});


module.exports = app;
