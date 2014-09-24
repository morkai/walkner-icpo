// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var fs = require('fs');
var path = require('path');

module.exports = function findFile(filePath, prefix, extensions, timeout, done)
{
  timeout = parseInt(timeout, 10);

  if (isNaN(timeout) || timeout < 100)
  {
    timeout = 30000;
  }

  var timer = setTimeout(cancel, timeout);
  var cancelled = false;

  function cancel()
  {
    if (cancelled)
    {
      return;
    }

    clearTimeout(timer);
    timer = null;
    cancelled = true;

    return done(null, false);
  }

  fs.readdir(filePath, function(err, files)
  {
    if (cancelled)
    {
      return;
    }

    clearTimeout(timer);

    if (err)
    {
      return done(err, null);
    }

    var pattern = new RegExp(prefix + '.*?\\.(' + extensions.join('|') + ')$', 'i');

    return done(null, files.filter(function(file) { return pattern.test(file); }));
  });

  return cancel;
};
