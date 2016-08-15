/* jslint node: false */

(function() {
  'use-strict';
  var root = this;
  var poke = {};

  if(typeof exports !== 'undefined') {
    if(typeof module !== 'undefined') {
      exports = module.exports = poke;
    }
    exports.poke = poke;
  } else {
    root.poke = poke;
  }

  // Subject names
  const BASE = 'pokenats.',
  BAD_REQ = 'bad',
  TRAINER_DATA_REQ = 'trainer.data',
  NEW_TRAINER_REQ = 'trainer.new',
  TRAINER_HB = 'trainer.hb',
  TRAINER_GENESIS = 'trainer.genesis',
  POKENAT_GENEIS = 'genesis';

  poke.BAD_REQ = BASE + BAD_REQ;
  poke.TRAINER_DATA_REQ = BASE + TRAINER_DATA_REQ;
  poke.NEW_TRAINER_REQ = BASE + NEW_TRAINER_REQ;
  poke.TRAINER_HB = BASE + TRAINER_HB;
  poke.TRAINER_GENESIS = BASE + TRAINER_GENESIS;
  poke.POKENATS_GENESIS = BASE + POKENAT_GENEIS;

  poke.TRAINER_HB_INTERVAL = 5000;


  // Geometry Support
  var geo = {};
  geo.CIRCUMFERENCE_KM = 40000;
  geo.GRID_WIDTH_KM = 1.0;
  geo.GRID_WIDTH = geo.CIRCUMFERENCE_KM / geo.GRID_WIDTH_KM;
  geo.GRID_HEIGHT = geo.GRID_WIDTH / 2;
  geo.GRID_LENGTH = geo.GRID_WIDTH * geo.GRID_HEIGHT;
  geo.DEGREES_PER_GRID = 360 / geo.GRID_WIDTH;
  geo.GRIDS_PER_DEGREE= geo.GRID_WIDTH / 360;
  poke.geo = geo;


  poke.distance = function(lat1,lon1,lat2,lon2) {
    var R = geo.CIRCUMFERENCE_KM / Math.PI * 2;
    var dLat = (lat2-lat1) * Math.PI / 180;
    var dLon = (lon2-lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180 ) * Math.cos(lat2 * Math.PI / 180 ) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };


  function translate(gps, x, y) {
    var retVal = {};
    // grid is longitude -180:+180, latitude -90:+90, normalize
    retVal.lng = gps.lng + x;
    retVal.lat = gps.lat + y;
    return retVal;
  };

  function Grid(gps) {
    if(! gps) {
      gps = {};
      gps.lng = -180;
      gps.lat = -90;
    }
    this.gps = gps;
    var grid = translate(gps, 180, 90);
    this.x = parseInt(grid.lng / geo.DEGREES_PER_GRID);
    this.y = parseInt(grid.lat / geo.DEGREES_PER_GRID);
    this.index = this.y * geo.GRID_WIDTH +  this.x;
    return this;
  };

  poke.Grid = Grid;

  Grid.prototype.bounds = function() {
    var bounds = {ll:{}, ur: {}};
    bounds.ll.lng = this.x * geo.DEGREES_PER_GRID;
    bounds.ll.lat = this.y * geo.DEGREES_PER_GRID;
    bounds.ll = translate(bounds.ll, -180, -90);
    bounds.ur.lng = bounds.ll.lng + geo.DEGREES_PER_GRID;
    bounds.ur.lat = bounds.ll.lat + geo.DEGREES_PER_GRID;

    return bounds;
  };

  Grid.prototype.normalize = function() {
    var ox = this.x;
    var oy = this.y;

    // moving around, simply clamp to the modulo
    ox = ox % geo.GRID_WIDTH;
    ox = ox < 0 ? -ox : ox;
    // if(ox < 0) {
    //   ox += geo.GRID_WIDTH;
    // }

    if(oy >= geo.GRID_HEIGHT || oy < 0) {
      // are we wrapping
      var y = oy % geo.GRID_HEIGHT;
      // figure out a direction
      var c = parseInt(oy / geo.GRID_HEIGHT);
      // if even, we wrapped to our current meridian, just add
      // otherwise go down from the top
      if (c % 2 !== 0) {
        // flip 180
        ox = (ox + geo.GRID_WIDTH / 2) % geo.GRID_WIDTH;
        oy -= y;
      } else {
        oy += y;
      }
    }
    this.x = ox;
    this.y = oy;

    this.index = this.y * geo.GRID_WIDTH +  this.x;
    this.gps.lng = this.x * geo.DEGREES_PER_GRID;
    this.gps.lat = this.y * geo.DEGREES_PER_GRID;
  };

  Grid.prototype.relative = function(x, y) {
    var g = new Grid({lat: this.gps.lat, lng: this.gps.lng});
    g.x += x;
    g.y += y;
    g.normalize();
    return g;
  };
}.call(this));

