// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var fs = require('fs');

module.exports = function readFile(file, timeout, done)
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

  fs.readFile(file, {encoding: 'utf8'}, function(err, contents)
  {
    if (cancelled)
    {
      return;
    }

    clearTimeout(timer);

    return done(err, contents);
  });

  return cancel;
};
