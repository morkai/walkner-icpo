// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

module.exports = function createErrorHandlerMiddleware(appModule, options)
{
  if (!options)
  {
    options = {};
  }

  // Based on https://github.com/expressjs/errorhandler
  return function errorHandlerMiddleware(err, req, res, next)
  {
    /*jshint unused:false*/

    if (err.status)
    {
      res.statusCode = err.status;
    }

    if (res.statusCode < 400)
    {
      res.statusCode = 500;
    }

    var login = req.session && req.session.user
      ? req.session.user.login
      : 'guest';

    if (req.method !== 'GET' && req.body !== null && typeof req.body === 'object')
    {
      try
      {
        appModule.warn(
          "%s %s\n%s\nUser: %s (%s)\nRequest body:\n%s",
          req.method,
          req.url,
          err.stack,
          login,
          req.ip,
          JSON.stringify(req.body)
        );
      }
      catch (err)
      {
        appModule.warn("%s %s\n%s\nUser: %s (%s)", req.method, req.url, err.stack, login, req.ip);
      }
    }
    else
    {
      appModule.warn("%s %s\n%s\nUser: %s (%s)", req.method, req.url, err.stack || err.message, login, req.ip);
    }

    var accept = req.headers.accept || '';

    if (accept.indexOf('html') !== -1)
    {
      res.render('error', {
        title: options.title || 'express',
        statusCode: res.statusCode,
        stack: prepareStack(options.basePath, err).reverse(),
        error: err.toString().replace(/\n/g, '<br>').replace(/^Error: /, '')
      });

      return;
    }

    if (accept.indexOf('json') !== -1)
    {
      var error = {
        message: err.message,
        stack: err.stack
      };

      Object.keys(err).forEach(function(prop) { error[prop] = err[prop]; });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({error: error}));

      return;
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end(err.stack);
  };
};

function prepareStack(basePath, err)
{
  var stack = (err.stack || '').split('\n').slice(1);

  if (stack.length === 0)
  {
    return [];
  }

  var no = stack.length;

  return stack.map(function(stack)
  {
    var matches = stack.match(/at (.*?) \((.*?):([0-9]+):([0-9]+)\)/);

    if (matches !== null)
    {
      return {
        no: no--,
        func: matches[1],
        path: matches[2],
        file: extractFile(basePath, matches[2]),
        line: matches[3],
        column: matches[4]
      };
    }

    matches = stack.match(/at (.*?):([0-9]+):([0-9]+)/);

    if (matches !== null)
    {
      return {
        no: no--,
        func: '?',
        path: matches[1],
        file: extractFile(basePath, matches[1]),
        line: matches[2],
        column: matches[3]
      };
    }

    return {
      no: no--,
      unknown: stack
    };
  });
}

function extractFile(basePath, path)
{
  if (!basePath || path.toLowerCase().indexOf(basePath.toLowerCase()) !== 0)
  {
    return path;
  }

  return '.' + path.substr(basePath.length);
}
