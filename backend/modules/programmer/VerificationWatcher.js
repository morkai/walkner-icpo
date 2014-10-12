// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var step = require('h5.step');

module.exports = VerificationWatcher;

function VerificationWatcher(timeout, inputPath, successPath, errorPath, filename, outputData)
{
  var m = moment();
  var currentMonth = m.format('YYYY-MM');
  var currentDay = m.format('DD');
  var nextMonth = m.add('days', 1).format('YYYY-MM');
  var nextDay = m.format('DD');

  this.timeout = timeout;
  this.inputPath = inputPath;
  this.successPaths = [
    path.join(successPath, currentMonth, currentDay),
    path.join(successPath, nextMonth, nextDay)
  ];
  this.errorPaths = [
    path.join(errorPath, currentMonth, currentDay),
    path.join(errorPath, nextMonth, nextDay)
  ];
  this.filename = filename;
  this.outputData = outputData;

  this.done = null;
  this.timer = null;
  this.watchers = [];
}

VerificationWatcher.prototype.destroy = function()
{
  if (this.timer !== null)
  {
    clearTimeout(this.timer);
    this.timer = null;
  }

  if (Array.isArray(this.watchers))
  {
    this.watchers.forEach(function(watcher)
    {
      clearTimeout(watcher);
    });
    this.watchers = null;
  }

  this.outputData = null;
  this.done = null;
};

VerificationWatcher.prototype.cancel = function()
{
  this.finish('CANCELLED');
};

VerificationWatcher.prototype.start = function(done)
{
  this.done = done;
  this.timer = setTimeout(this.onTimeout.bind(this), this.timeout);
  this.watchers = [];

  var watcher = this;

  fs.writeFile(path.join(this.inputPath, this.filename), this.outputData, function(err)
  {
    if (err)
    {
      err.code = 'VERIFICATION_INPUT_FAILURE';

      watcher.finish(err);
    }
    else
    {
      watcher.watchPaths();
    }
  });
};

VerificationWatcher.prototype.watchPaths = function()
{
  var i;
  var l;

  for (i = 0, l = this.successPaths.length; i < l; ++i)
  {
    this.watchPath('success', path.join(this.successPaths[i], this.filename));
  }

  for (i = 0, l = this.errorPaths.length; i < l; ++i)
  {
    this.watchPath('error', path.join(this.errorPaths[i], this.filename));
  }
};

VerificationWatcher.prototype.watchPath = function(result, resultsPath)
{
  if (!this.done)
  {
    return;
  }

  var watcher = this;

  fs.exists(resultsPath, function(exists)
  {
    if (!watcher.done)
    {
      return;
    }

    if (exists)
    {
      watcher.finish(result === 'error' ? 'VERIFICATION_ERROR' : null);
    }
    else
    {
      watcher.watchers.push(setTimeout(watcher.watchPath.bind(watcher, result, resultsPath), 100));
    }
  });
};

VerificationWatcher.prototype.onTimeout = function()
{
  this.timer = null;

  this.finish('VERIFICATION_TIMEOUT');
};

VerificationWatcher.prototype.finish = function(err)
{
  var done = this.done;

  this.destroy();

  if (typeof done === 'function')
  {
    done(err);
  }
};