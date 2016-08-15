var express = require('express'),
cookieParser = require('cookie-parser'),
path = require('path'),
app = express(),
fs = require('fs'),
crypto = require('crypto'),
trainer = require('../lib/Trainer'),
nuid = require('nuid');

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// This gateway will never scale. Simply here for a test.
var trainers = {};


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


app.all('/trainer/lat/:lat/lng/:lng', function(req, res) {
  var opts = {location:{lat: parseFloat(req.params.lat), lng: parseFloat(req.params.lng)}, serviceType: 'trainer'};
  var trainerID = req.cookies.trainerID || nuid.next();
  var e;
  var t;
  if(trainerID) {
    opts.client = trainerID;
    e = trainers[trainerID];
    if(e && e.trainer) {
      t = e.trainer;
    }
  }
  if(! e) {
    e = {genesis:[], energy:0};
  }

  req.body = JSON.stringify({email:'alberto.ricart@apcera.com'});

  if(req.body) {
    try {
      var body = JSON.parse(req.body);
      if(body.email) {
        e.emailHash = crypto.createHash('md5').update(body.email).digest('hex').toLowerCase();
      }
    } catch(err) {
      console.log('error processing req body as json: ' + req.body);
    }
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