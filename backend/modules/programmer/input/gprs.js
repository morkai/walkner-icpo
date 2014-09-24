// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var createHash = require('crypto').createHash;
var path = require('path');
var fs = require('fs');
var readFile = require('../readFile');

module.exports = function setUpGprsInput(app, programmerModule)
{
  var settings = app[programmerModule.config.settingsId];
  var currentState = programmerModule.currentState;

  var TELEMANAGEMENT_MODES = {
    F: 'FutureProof',
    T: 'Telemanaged'
  };
  var SWITCH_REGIMES = {
    A: 'AlwaysOn',
    P: 'PhotoCell'
  };
  var PHOTO_CELL_LEVELS = {
    _: 'Levels_Unknown',
    A: 'Levels_38_18',
    B: 'Levels_55_28',
    C: 'Levels_70_35',
    D: 'Levels_35_18'
  };

  function error(reason)
  {
    programmerModule.changeState({gprsStatus: 'error:' + reason});
  }

  return function loadGprsData()
  {
    var gprsFile = currentState.gprs + '.xml';
    var gprsFilePath = path.join(settings.get('gprsPath'), gprsFile);

    readFile(gprsFilePath, settings.get('readTimeout'), function(err, gprsFileContents)
    {
      if (err)
      {
        programmerModule.error("Failed to read GPRS XML [%s]: %s", gprsFilePath, err.message);

        return error(err.code === 'ENOENT' ? 'notFound' : 'readFile');
      }

      if (gprsFileContents === false)
      {
        return error('timeout:readFile');
      }

      var matches = gprsFileContents.match(/(F|T)(P|A)(_|A|B|C|D)/);

      if (matches === null)
      {
        return error('data:gprs');
      }

      var gprsData = {
        telemanagementMode: TELEMANAGEMENT_MODES[matches[1]],
        switchRegime: SWITCH_REGIMES[matches[2]],
        photoCellLevels: PHOTO_CELL_LEVELS[matches[3]]
      };

      currentState.gprsFilePath = gprsFilePath;
      currentState.gprsFileHash = createHash('md5').update(gprsFileContents).digest('hex');

      var localFilePath = path.join(programmerModule.config.storagePath, currentState.gprsFileHash);

      fs.writeFile(localFilePath, gprsFileContents, function(err)
      {
        if (err)
        {
          programmerModule.error("Failed to write GPRS XML [%s]: %s", localFilePath, err.message);

          return error('writeFile');
        }

        currentState.gprsData = gprsData;

        programmerModule.changeState({gprsStatus: 'loaded'});
      });
    });
  };
};
