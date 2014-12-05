// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var path = require('path');
var setUpCommands = require('./commands');
var setUpInput = require('./input');
var program = require('./program');

exports.DEFAULT_CONFIG = {
  settingsId: 'settings',
  historyId: 'history',
  sqlite3Id: 'sqlite3',
  sioId: 'sio',
  storagePath: './',
  outputFilePath: './output.xml'
};

exports.start = function startProgrammerModule(app, module)
{
  var settings = app[module.config.settingsId];

  if (!settings)
  {
    throw new Error("settings module is required!");
  }

  var sqlite3Module = app[module.config.sqlite3Id];

  if (!sqlite3Module)
  {
    throw new Error("sqlite3 module is required!");
  }

  var historyModule = app[module.config.historyId];

  if (!historyModule)
  {
    throw new Error("history module is required!");
  }

  module.getFilePath = function(type, filename)
  {
    return path.join(module.config.storagePath, filename + '.' + type);
  };

  module.currentState = historyModule.createEntry();

  module.program = program.bind(null, app, module);

  module.isInputDataLoaded = function()
  {
    return module.currentState.serviceTagStatus === 'loaded'
      && module.currentState.driverStatus === 'loaded'
      && module.currentState.gprsStatus === 'loaded'
      && module.currentState.ledStatus === 'loaded';
  };

  module.log = function(text, data)
  {
    if (!Array.isArray(module.currentState.log))
    {
      return;
    }

    if (!data)
    {
      data = {};
    }

    if (typeof data.time !== 'number')
    {
      data.time = Date.now();
    }

    data.text = text;

    module.currentState.log.push(data);

    app.broker.publish('programmer.logged', data);
  };

  module.changeState = function(changes)
  {
    if (typeof changes === 'undefined')
    {
      app.broker.publish('programmer.stateChanged', module.currentState.toJSON());
    }
    else
    {
      Object.keys(changes).forEach(function(key)
      {
        module.currentState[key] = changes[key];
      });

      app.broker.publish('programmer.stateChanged', changes);
    }
  };

  setUpInput(app, module);

  app.onModuleReady(
    [
      module.config.sioId
    ],
    setUpCommands.bind(null, app, module)
  );
};
