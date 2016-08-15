/**
 * Created by albertoricart on 8/12/16.
 */

/* jslint node: true */
/* global describe: false, before: false, after: false, it: false */
'use strict';

var should = require('should'),
poke = require('../lib/common.js');


function clamp(v, m) {
  if(v >= m) {
    v = v % m;
  }
  return v;
}

function rotate(v, m) {
  if(v >= m) {
    v = (v % (m * 2)) / 2;
  }
  return v;
}

describe('Grid', function() {
  it('should be zero', function() {
    var grid = new poke.Grid({lat:-90, lng:-180});
    grid.index.should.be.equal(0);
  });

  it('should be max index', function() {
    var grid = new poke.Grid({lat:90, lng:180});
    grid.index.should.be.equal(poke.geo.GRID_LENGTH);
  });

  it('should be grid.width + grid.width * grid.height', function() {
    var grid = new poke.Grid({lat:0, lng:0});

    grid.index.should.be.equal((poke.geo.GRID_WIDTH * poke.geo.GRID_HEIGHT)/2);
  });

  it('should be 180 or -180 lng', function() {
    var grid = new poke.Grid({lat:0, lng:0});
    grid.x.should.be.equal(0);
    grid.x += poke.geo.GRID_WIDTH / 2;
    grid.normalize();
    grid.x.should.be.equal(18);
  });

  it('relative north should work', function() {
    var grid = new poke.Grid({lat:0, lng:0});
    var g2 = grid.relative(0, 1);
    g2.index.should.be.equal(grid.index+poke.geo.GRID_WIDTH);
  });

  it('relative south should work', function() {
    var grid = new poke.Grid({lat:0, lng:0});
    var g2 = grid.relative(0, -1);
    g2.index.should.be.equal(grid.index - poke.geo.GRID_WIDTH);
  });

  it('relative left should work', function() {
    var grid = new poke.Grid({lat:0, lng:0});
    var left = grid.relative(-1, 0);
    left.index.should.be.equal(grid.index + poke.geo.GRID_WIDTH - 1);
  });

  it('relative right should work', function() {
    var grid = new poke.Grid({lat:0, lng:0});
    var right = grid.relative(1, 0);
    right.index.should.be.equal(grid.index+1);
  });

  it('should wrap the row going left', function() {
    var grid = new poke.Grid({lat:-90, lng:-180});
    var left = grid.relative(-1, 0);
    left.index.should.be.equal(poke.geo.GRID_WIDTH-1);
  });

  it('should wrap the row going right', function() {
    var grid = new poke.Grid({lat:-90, lng:-180});
    var left = grid.relative(+poke.geo.GRID_WIDTH, 0);
    left.index.should.be.equal(0);
  });

  it('should wrap col going up', function() {
    var grid = new poke.Grid({lat:90, lng:180});
    var up = grid.relative(0, 1);
    up.y.should.be.equal(grid.y);
  });
});


