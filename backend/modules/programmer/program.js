// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var createHash = require('crypto').createHash;
var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var lodash = require('lodash');
var moment = require('moment');
var step = require('h5.step');
var readFile = require('./readFile');
var VerificationWatcher = require('./VerificationWatcher');
var STANDARD_CLO_PROFILE = fs.readFileSync(__dirname + '/stdCloProfile.xml', 'utf8');

module.exports = function program(app, programmerModule, done)
{
  var currentState = programmerModule.currentState;

  if (currentState.isProgramming())
  {
    return done(new Error('IN_PROGRESS'));
  }
  else
  {
    done();
  }

  var settings = app[programmerModule.config.settingsId];

  programmerModule.cancelled = false;

  currentState.onProgramStart();

  programmerModule.changeState();

  step(
    readInputTemplateFileStep,
    handleReadInputTemplateFileResultStep,
    prepareInputFileStep,
    handlePrepareInputFileResultStep,
    tryToProgramStep,
    handleTryToProgramResultStep,
    hashOutputFileStep,
    setUpVerificationWatchersStep,
    finalizeStep
  );

  function readInputTemplateFileStep()
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 1});

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    var inputTemplatePath = settings.get('inputTemplatePath');

    programmerModule.log('READING_INPUT_TEMPLATE_FILE', {
      inputTemplateFile: settings.get('inputTemplatePath')
    });

    this.sub = app.broker.subscribe(
      'programmer.cancelled',
      readFile(
        inputTemplatePath,
        settings.get('readTimeout'),
        this.next()
      )
    );
  }

  function handleReadInputTemplateFileResultStep(err, inputTemplate)
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 5});

    this.sub.cancel();
    this.sub = null;

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    if (err)
    {
      if (err.code === 'ENOENT')
      {
        return this.skip('INPUT_TEMPLATE_FILE_MISSING');
      }
      else
      {
        err.code = 'INPUT_TEMPLATE_FILE_FAILURE';

        return this.skip(err);
      }
    }

    if (inputTemplate === false)
    {
      return this.skip('INPUT_TEMPLATE_FILE_TIMEOUT');
    }

    programmerModule.log('READING_INPUT_TEMPLATE_FILE_SUCCESS', {
      length: Buffer.byteLength(inputTemplate, 'utf8')
    });

    programmerModule.log('PARSING_INPUT_TEMPLATE');

    var inputData;

    try
    {
      inputData = JSON.parse(inputTemplate);

      if (!lodash.isObject(inputData))
      {
        inputData = {};
      }
    }
    catch (err)
    {
      err.code = 'PARSING_INPUT_TEMPLATE_FAILURE';

      return this.skip(err);
    }

    programmerModule.log('PARSING_INPUT_TEMPLATE_SUCCESS');

    this.inputData = inputData;

    setImmediate(this.next());
  }

  function prepareInputFileStep()
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 10});

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    programmerModule.log('PREPARING_INPUT_FILE');

    var inputData = this.inputData;

    applyOrderData(inputData, programmerModule.currentState.orderData);
    applyDriverData(inputData, programmerModule.currentState.driverData);
    applyGprsData(inputData, programmerModule.currentState.gprsData);

    inputData.productionDate = moment().format('YYYY-MM-DDTHH:mm:ss');
    inputData.serviceTag = programmerModule.currentState.serviceTag.substr(4);

    inputData.drivers.forEach(function(driver)
    {
      driver.lightSources.forEach(function(lightSource)
      {
        lightSource.serialNumber = programmerModule.currentState.led;
      });
    });

    this.inputData = JSON.stringify(inputData, null, 2);

    programmerModule.currentState.inputFileHash = createHash('md5').update(this.inputData).digest('hex');

    this.inputFilePath = path.join(programmerModule.config.storagePath, programmerModule.currentState.inputFileHash);

    fs.writeFile(this.inputFilePath, this.inputData, this.next());
  }

  function applyOrderData(inputData, orderData)
  {
    var customerID = inputData.salesOrder && inputData.salesOrder.customerID !== undefined
      ? inputData.salesOrder.customerID
      : 0;

    lodash.extend(inputData, orderData);

    delete inputData.lightColor;

    inputData.salesOrder.customerID = customerID;

    inputData.drivers = (Array.isArray(inputData.drivers) ? inputData.drivers : []).filter(lodash.isObject);

    if (!inputData.drivers.length)
    {
      inputData.drivers.push({});
    }

    inputData.drivers.forEach(function(driver)
    {
      driver.lightSources = (Array.isArray(driver.lightSources) ? driver.lightSources : []).filter(lodash.isObject);

      if (!driver.lightSources.length)
      {
        driver.lightSources.push({});
      }

      driver.lightSources.forEach(function(lightSource)
      {
        lightSource.lightColor = orderData.lightColor;
      });
    });
  }

  function applyDriverData(inputData, driverData)
  {
    inputData.cloEnabled = driverData.cloEnabled;
    inputData.cloProfile = driverData.cloProfile;

    inputData.drivers.forEach(function(driver)
    {
      driver.current = driverData.current;
      driver.startupDelay = driverData.startupDelay;
      driver.ntcSelection = driverData.ntcSelection;
      driver.moduleThermalProtection = {
        warningTemperature: driverData.warningTemperature,
        maxTemperature: driverData.maxTemperature,
        minDimLevel: driverData.minDimLevel
      };
    });

    if (!lodash.isObject(inputData.olc))
    {
      inputData.olc = {};
    }

    inputData.olc.dynaDimmerEnabled = driverData.dynaDimmerEnabled;
    inputData.olc.dynaDimmerProfile = driverData.dynaDimmerProfile;
    inputData.olc.midPointShift = driverData.midPointShift;
  }

  function applyGprsData(inputData, gprsData)
  {
    inputData.olc.switchRegime = gprsData.switchRegime;
    inputData.olc.photoCellLevels = gprsData.photoCellLevels;
    inputData.olc.telemanagementMode = gprsData.telemanagementMode;
  }

  function handlePrepareInputFileResultStep(err)
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 20});

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    if (err)
    {
      err.code = 'PREPARING_INPUT_FILE_FAILURE';

      return this.skip(err);
    }

    programmerModule.log('PREPARING_INPUT_FILE_SUCCESS');

    setImmediate(this.next());
  }

  function tryToProgramStep()
  {
    /*jshint validthis:true*/

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    var programmerFile = settings.get('programmerFile');

    if (typeof programmerFile !== 'string' || !programmerFile.length)
    {
      return this.skip('PROGRAMMER_FILE_UNSET');
    }
// TODO: program
    var args = [
      'simulate',
      //'program',
      '-p', String(settings.get('daliPort') || 0),
      '-j', this.inputFilePath,
      '-c', programmerModule.config.outputFilePath
    ];

    var options = {
      cwd: path.dirname(programmerFile)
    };

    programmerModule.log('PROGRAMMER_FILE_STARTED', {
      programmerFile: programmerFile,
      daliPort: args[2]
    });

    var programmer = spawn(programmerFile, args, options);
    var next = this.next();
    var finalized = false;
    var output = '';
    var progress = '';

    programmer.on('exit', function(exitCode)
    {
      if (exitCode === 0)
      {
        finalize();
      }
      else
      {
        finalize('EXIT_CODE:' + exitCode);
      }
    });

    programmer.on('error', function(err)
    {
      if (err.code === 'ENOENT')
      {
        finalize('PROGRAMMER_FILE_MISSING');
      }
      else
      {
        err.code = 'PROGRAMMER_FILE_FAILURE';

        finalize(err);
      }
    });

    programmer.stderr.on('data', onData);
    programmer.stdout.on('data', onData);

    this.sub = app.broker.subscribe('programmer.cancelled', function()
    {
      programmer.stderr.removeAllListeners();
      programmer.stdout.removeAllListeners();
      programmer.removeAllListeners();
      programmer.on('error', function() {});
      programmer.kill();

      finalize('CANCELLED');
    });

    function onData(data)
    {
      /*jshint -W084*/

      output += data;

      if (progress === null)
      {
        return;
      }

      progress += data;

      if (progress.indexOf('Programming finished') !== -1)
      {
        updateProgress();

        progress = null;

        programmerModule.log('PROGRAMMING_PROGRESS', {
          percentage: 100
        });
      }
      else if (updateProgress())
      {
        progress = '';
      }
    }

    function updateProgress()
    {
      var found = false;
      var pos;

      while ((pos = progress.indexOf('Progress: ')) !== -1)
      {
        var matches = progress.substr(pos).match(/^Progress: ([0-9]+)%/);

        if (!matches)
        {
          break;
        }

        var percentage = parseInt(matches[1], 10);

        programmerModule.changeState({
          progress: 20 + Math.round(percentage * 45 / 100)
        });

        programmerModule.log('PROGRAMMING_PROGRESS', {
          percentage: percentage
        });

        found = true;
        progress = progress.substr(pos + matches[0].length);
      }

      return found;
    }

    function finalize(err)
    {
      if (finalized)
      {
        return;
      }

      finalized = true;

      programmerModule.changeState({
        progress: 65,
        output: output
      });

      setImmediate(function() { next(err); });
    }
  }

  function handleTryToProgramResultStep(err)
  {
    /*jshint validthis:true*/

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    if (err)
    {
      return this.skip(err);
    }

    if (this.sub != null)
    {
      this.sub.cancel();
      this.sub = null;
    }

    programmerModule.log('READING_OUTPUT_FILE', {
      outputFile: programmerModule.config.outputFilePath
    });

    fs.readFile(programmerModule.config.outputFilePath, 'utf8', this.next());
  }

  function hashOutputFileStep(err, outputFileContents)
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 68});

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    if (err)
    {
      err.code = 'OUTPUT_FILE_MISSING';

      return this.skip(err);
    }

    fs.unlink(programmerModule.config.outputFilePath, function(err)
    {
      if (err)
      {
        programmerModule.error("Failed to remove the output file: %s", err.message);
      }
    });

    programmerModule.log('READING_OUTPUT_FILE_SUCCESS', {
      length: Buffer.byteLength(outputFileContents)
    });

    programmerModule.currentState.outputFileHash = createHash('md5').update(outputFileContents).digest('hex');

    if (!programmerModule.currentState.driverData.cloEnabled)
    {
      outputFileContents = outputFileContents.replace(/<CloProfile.*?\/>/, STANDARD_CLO_PROFILE);
    }

    this.outputData = outputFileContents;
    this.outputFilePath = path.join(programmerModule.config.storagePath, programmerModule.currentState.outputFileHash);

    programmerModule.log('COPYING_OUTPUT_FILE');

    fs.writeFile(this.outputFilePath, outputFileContents, this.next());
  }

  function setUpVerificationWatchersStep(err)
  {
    /*jshint validthis:true*/

    programmerModule.changeState({progress: 70});

    if (programmerModule.cancelled)
    {
      return this.skip('CANCELLED');
    }

    if (err)
    {
      err.code = 'COPYING_OUTPUT_FILE_FAILURE';

      return this.skip(err);
    }

    programmerModule.log('COPYING_OUTPUT_FILE_SUCCESS');

    var skipVerification = !settings.get('verification');

    if (skipVerification)
    {
      programmerModule.log('VERIFICATION_SKIPPED');
    }
    else
    {
      programmerModule.log('VERIFICATION_STARTED');
    }

    this.verificationWatcher = new VerificationWatcher(
      skipVerification,
      settings.get('verificationTimeout'),
      settings.get('verificationInputPath'),
      settings.get('verificationSuccessPath'),
      settings.get('verificationErrorPath'),
      programmerModule.currentState.serviceTag.substr(4) + '.xml',
      this.outputData
    );

    this.verificationWatcher.progress = function(percentage)
    {
      programmerModule.changeState({progress: 70 + Math.round(percentage * 30 / 100)});
    };

    this.sub = app.broker.subscribe(
      'programmer.cancelled',
      this.verificationWatcher.cancel.bind(this.verificationWatcher)
    );

    this.verificationWatcher.start(this.next());
  }

  function finalizeStep(err)
  {
    /*jshint validthis:true*/

    if (this.sub != null)
    {
      this.sub.cancel();
      this.sub = null;
    }

    if (this.verificationWatcher != null)
    {
      this.verificationWatcher.destroy();
      this.verificationWatcher = null;
    }

    this.inputData = null;
    this.inputFilePath = null;
    this.outputData = null;
    this.outputFilePath = null;

    var finishedAt = Date.now();
    var duration = finishedAt - programmerModule.currentState.startedAt;
    var changes = {
      finishedAt: finishedAt,
      errorCode: 0,
      exception: null,
      result: 'success'
    };

    if (err)
    {
      changes.result = 'failure';

      if (typeof err === 'string')
      {
        changes.errorCode = err;
      }
      else
      {
        changes.errorCode = err.code;
        changes.exception = err.message;
      }

      programmerModule.log('PROGRAMMING_FAILURE', {
        time: changes.finishedAt,
        duration: duration,
        errorCode: changes.errorCode
      });
    }
    else
    {
      changes.counter = currentState.counter + 1;

      programmerModule.log('PROGRAMMING_SUCCESS', {
        time: changes.finishedAt,
        duration: duration
      });
    }

    programmerModule.changeState(changes);

    app.broker.publish('programmer.finished', currentState.toJSON());

    currentState.save(function(err)
    {
      if (err)
      {
        programmerModule.error("Failed to save the current state: %s", err.stack);
      }
    });
  }

};
