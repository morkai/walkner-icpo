// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var lodash = require('lodash');

module.exports = function setUpProgrammerCommands(app, programmerModule)
{
  var settings = app[programmerModule.config.settingsId];

  app[programmerModule.config.sioId].on('connection', function(socket)
  {
    socket.on('programmer.getCurrentState', getCurrentState);

    if (socket.handshake.address.address === '127.0.0.1')
    {
      socket.on('programmer.input', input);
      socket.on('programmer.cancel', cancel);
      socket.on('programmer.program', program);
      socket.on('programmer.reset', reset);
    }
  });

  function getCurrentState(reply)
  {
    if (lodash.isFunction(reply))
    {
      reply(programmerModule.currentState.toJSON());
    }
  }

  function input(property, value, reply)
  {
    if (!lodash.isFunction(reply))
    {
      return;
    }

    if (!lodash.isFunction(programmerModule.input[property]) || !lodash.isString(value))
    {
      return reply(new Error('INPUT'));
    }

    reset();

    var statusProperty = property + 'Status';
    var currentStatus = programmerModule.currentState[statusProperty];
    var changes = {};

    changes[property] = value;

    if (value === programmerModule.currentState[property] && currentStatus === 'loaded')
    {
      reply();

      changes[statusProperty] = currentStatus;

      return programmerModule.changeState(changes);
    }

    if (value === '')
    {
      changes[statusProperty] = 'waiting';
    }
    else if (!isValidInputValue(property, value))
    {
      changes[statusProperty] = 'error:format';
    }
    else
    {
      if (changes[statusProperty] === 'loading')
      {
        return reply();
      }

      changes[statusProperty] = 'loading';
    }

    reply();

    programmerModule.changeState(changes);

    if (changes[statusProperty] === 'loading')
    {
      programmerModule.input[property]();
    }
  }

  function cancel(reply)
  {
    if (!lodash.isFunction(reply))
    {
      return;
    }

    reply();

    if (!programmerModule.currentState.isProgramming())
    {
      return;
    }

    programmerModule.log('CANCELLING');

    if (!programmerModule.cancelled)
    {
      programmerModule.cancelled = true;

      app.broker.publish('programmer.cancelled');
    }
  }

  function program(reply)
  {
    if (!lodash.isFunction(reply))
    {
      return;
    }

    if (!programmerModule.isInputDataLoaded())
    {
      return reply();
    }

    programmerModule.program(reply);
  }

  function reset()
  {
    if (programmerModule.currentState.result)
    {
      programmerModule.currentState.clear();
      programmerModule.changeState();
    }
  }

  function isValidInputValue(property, value)
  {
    if (property === 'serviceTag')
    {
      return /^P000[0-9]{12}$/.test(value);
    }

    if (property === 'driver' || property === 'gprs')
    {
      return /^[0-9]{12}$/.test(value);
    }

    if (property === 'led')
    {
      return /^[0-9A-Z]{12,25}$/.test(value);
    }

    return false;
  }
};
