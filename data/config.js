/*jshint maxlen:false*/

'use strict';

var path = require('path');

var DATA_PATH = path.join(__dirname, '..', 'data');

var config = module.exports = require('../bin/walkner-icpo/config/frontend.js');

config.httpServer.port = 1338;

config.sqlite3.dbFile = path.join(DATA_PATH, 'walkner-icpo.sqlite3');

config.programmer.storagePath = path.join(DATA_PATH, 'walkner-icpo-storage');
config.programmer.outputFilePath = path.join(DATA_PATH, 'walkner-icpo-output.xml');

config.history.storagePath = config.programmer.storagePath;
config.history.lastExportTimeFile = path.join(DATA_PATH, 'walkner-icpo-export.txt');
config.history.exportLimit = 25;

config.settings.settingsFile = path.join(DATA_PATH, 'walkner-icpo.json');
config.settings.defaults.password = '1@3';
config.settings.defaults.inputTemplatePath = path.join(DATA_PATH, 'walkner-icpo-input.json');
config.settings.defaults.orderPath = '\\\\code1\\plrketchr8-box1\\Etykiety\\Input';
config.settings.defaults.driverPath = '\\\\code1\\plrketchr8-box1\\Dokumentacja.technologiczna\\-=- Centrum dystrybucji\\Programowanie driverow\\1. Programy\\5. Multione';
config.settings.defaults.gprsPath = '\\\\code1\\plrketchr8-box1\\Dokumentacja.technologiczna\\-=- Programowanie\\1. Programy GPRS\\1. Iridium3';
config.settings.defaults.verificationInputPath = '\\\\code1\\plrketchr8-box1\\GPRS\\Input';
config.settings.defaults.verificationSuccessPath = '\\\\code1\\plrketchr8-box1\\GPRS\\Success';
config.settings.defaults.verificationErrorPath = '\\\\code1\\plrketchr8-box1\\GPRS\\Error';
config.settings.defaults.programmerFile = 'C:\\ICP\\CityTouchIPT.exe';
