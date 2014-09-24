/*jshint maxlen:false*/

'use strict';

var fs = require('fs');

var DATA_PATH = __dirname + '/../data';

exports.id = 'walkner-icpo';

exports.modules = [
  'sqlite3',
  'settings',
  'history',
  'programmer',
  'imWorkin',
  'pubsub',
  'express',
  'httpServer',
  'sio'
];

exports.sqlite3 = {
  dbFile: DATA_PATH + '/db.sqlite3'
};

exports.programmer = {
  storagePath: DATA_PATH + '/storage',
  outputFilePath: DATA_PATH + '/output.xml'
};

exports.history = {
  storagePath: exports.programmer.storagePath,
  lastExportTimeFile: DATA_PATH + '/lastExportAt.txt'
};

exports.settings = {
  settingsFile: DATA_PATH + '/settings.json',
  licenseEdPem: fs.existsSync(__dirname + '/license.ed.public.pem')
    ? fs.readFileSync(__dirname + '/license.ed.public.pem', 'utf8')
    : null,
  defaults: {
    password: '!cP0',
    id: process.env.COMPUTERNAME || exports.id,
    licenseKey: '',
    licenseInfo: {
      appId: null,
      appVersion: null,
      date: '0000-00-00',
      uuid: '00000000-0000-0000-0000-000000000000',
      features: 0,
      error: 'NO_KEY'
    },
    title: '',
    remoteServer: '',
    syncInterval: 30,
    inputTemplatePath: DATA_PATH + '/input.json',
    orderPath: DATA_PATH + '/input/orders',
    driverPath: DATA_PATH + '/input/drivers',
    gprsPath: DATA_PATH + '/input/gprs',
    verificationInputPath: DATA_PATH + '/verification/input',
    verificationSuccessPath: DATA_PATH + '/verification/success',
    verificationErrorPath: DATA_PATH + '/verification/error',
    verificationTimeout: 2 * 60 * 1000,
    verification: 1,
    readTimeout: 5 * 1000,
    programmerFile: 'C:/ICP Debug/CityTouchIPT.exe',
    daliPort: 0,
    imWorkin: 0,
    hotkeys: {
      focusServiceTag: 'Q',
      focusDriver: 'W',
      focusGprs: 'E',
      focusLed: 'R',
      toggleMode: 'A',
      program: 'Space',
      cancel: 'Space',
      showDashboardPage: 'Z',
      showHistoryPage: 'X',
      showSettingsPage: 'C'
    }
  }
};

exports.httpServer = {
  host: '0.0.0.0',
  port: 1338
};

exports.pubsub = {
  statsPublishInterval: 60000,
  republishTopics: [
    'settings.changed',
    'programmer.stateChanged',
    'programmer.logged',
    'programmer.finished'
  ]
};

exports.express = {
  mongooseId: null,
  staticPath: __dirname + '/../frontend',
  staticBuildPath: __dirname + '/../frontend-build',
  cookieSecret: null,
  ejsAmdHelpers: {
    t: 'app/i18n'
  },
  title: exports.id
};
