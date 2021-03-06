// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var fs = require('fs');
var lodash = require('lodash');
var setUpRoutes = require('./routes');
var validateLicense = require('./validateLicense');

exports.DEFAULT_CONFIG = {
  expressId: 'express',
  programmerId: 'programmer',
  settingsFile: 'settings.json',
  defaults: {}
};

exports.start = function startSettingsModule(app, module, done)
{
  var settings = {};

  module.has = function(name)
  {
    return name !== 'password' && name !== 'licenseKey' && typeof settings[name] !== 'undefined';
  };

  module.get = function(name)
  {
    return typeof name === 'undefined' ? settings : settings[name];
  };

  module.export = function(password, includeLicenseInfo)
  {
    var copy = lodash.merge({}, settings);

    if (password === copy.password)
    {
      copy.password1 = password;
      copy.password2 = password;
    }
    else
    {
      delete copy.licenseKey;

      if (!includeLicenseInfo)
      {
        delete copy.licenseInfo;
      }
    }

    delete copy.password;

    return copy;
  };

  module.import = function(newSettings, done, allowEmpty)
  {
    if (settings.password)
    {
      if (newSettings.password !== settings.password)
      {
        return done(new Error('PASSWORD'));
      }
    }
    else
    {
      delete newSettings.password;
    }

    var changes = validateSettings(newSettings);

    if (lodash.isEmpty(changes) && !allowEmpty)
    {
      return done(new Error('INVALID_CHANGES'));
    }

    settings = lodash.merge(settings, changes);

    fs.writeFile(
      module.config.settingsFile,
      JSON.stringify(settings),
      {encoding: 'utf8'},
      function(err)
      {
        if (err)
        {
          return done(err);
        }

        done();

        if (!lodash.isEmpty(changes))
        {
          delete changes.licenseKey;

          app.broker.publish('settings.changed', changes);
        }
      }
    );
  };

  app.onModuleReady(
    [
      module.config.expressId
    ],
    setUpRoutes.bind(null, app, module)
  );

  fs.readFile(module.config.settingsFile, {encoding: 'utf8'}, function(err, contents)
  {
    if (err && err.code !== 'ENOENT')
    {
      return done(err);
    }

    try
    {
      settings = JSON.parse(contents || '{}');
    }
    catch (err)
    {
      module.warn("Failed to parse the settings file: %s", err.message);
    }

    if (settings === null || typeof settings !== 'object')
    {
      settings = {};
    }

    settings = lodash.defaults(settings, module.config.defaults);

    module.import(lodash.merge({}, settings), done, true);
  });

  function validateSettings(rawSettings)
  {
    var newSettings = {};

    validateLicense(app, module, rawSettings, newSettings, settings);
    validateStringSetting(rawSettings, newSettings, 'password1');
    validateStringSetting(rawSettings, newSettings, 'id', 1, /^[a-zA-Z0-9-_]+$/);
    validateStringSetting(rawSettings, newSettings, 'title', 0);
    validateStringSetting(rawSettings, newSettings, 'inputTemplatePath');
    validateStringSetting(rawSettings, newSettings, 'orderPath');
    validateStringSetting(rawSettings, newSettings, 'driverPath');
    validateStringSetting(rawSettings, newSettings, 'gprsPath');
    validateStringSetting(rawSettings, newSettings, 'verificationInputPath');
    validateStringSetting(rawSettings, newSettings, 'verificationSuccessPath');
    validateStringSetting(rawSettings, newSettings, 'verificationErrorPath');
    validateStringSetting(rawSettings, newSettings, 'programmerFile');
    validateStringSetting(rawSettings, newSettings, 'remoteServer', 0);
    validateNumericSetting(rawSettings, newSettings, 'verificationTimeout', 1000);
    validateNumericSetting(rawSettings, newSettings, 'syncInterval', 10);
    validateNumericSetting(rawSettings, newSettings, 'readTimeout', 100);
    validateNumericSetting(rawSettings, newSettings, 'daliPort', 0);
    validateEnum(rawSettings, newSettings, 'imWorkin', Number, [0, 1]);
    validateEnum(rawSettings, newSettings, 'verification', Number, [0, 1]);
    validateHotkeys(rawSettings, newSettings);

    if (newSettings.password1)
    {
      newSettings.password = newSettings.password1;

      delete newSettings.password1;
    }

    if (lodash.isEmpty(newSettings))
    {
      return null;
    }

    return newSettings;
  }

  function validateStringSetting(rawSettings, newSettings, setting, minLength, pattern)
  {
    if (typeof minLength !== 'number')
    {
      minLength = 1;
    }

    var value = rawSettings[setting];

    if (lodash.isString(value)
      && value.length >= minLength
      && value !== settings[setting]
      && (!pattern || pattern.test(value)))
    {
      newSettings[setting] = value;
    }
  }

  function validateNumericSetting(rawSettings, newSettings, setting, min)
  {
    if (!lodash.isNumber(min))
    {
      min = 1;
    }

    var value = parseInt(rawSettings[setting], 10);

    if (!isNaN(value) && value >= min && value !== settings[setting])
    {
      newSettings[setting] = value;
    }
  }

  function validateEnum(rawSettings, newSettings, setting, cast, values)
  {
    var value = cast(rawSettings[setting]);

    if (values.indexOf(value) !== -1 && value !== settings[setting])
    {
      newSettings[setting] = value;
    }
  }

  function validateHotkeys(rawSettings, newSettings)
  {
    if (!lodash.isObject(rawSettings.hotkeys))
    {
      return;
    }

    var hotkeys = {};
    var changes = 0;

    Object.keys(rawSettings.hotkeys).forEach(function(action)
    {
      var hotkey = rawSettings.hotkeys[action];

      if (/^[a-zA-Z0-9]+$/.test(action)
        && lodash.isString(hotkey)
        && (hotkey.length <= 1 || hotkey === 'Space'))
      {
        hotkeys[action] = hotkey.length ? rawSettings.hotkeys[action] : null;

        if (hotkey !== settings.hotkeys[action])
        {
          ++changes;
        }
      }
    });

    if (changes > 0)
    {
      newSettings.hotkeys = hotkeys;
    }
  }
};
