// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

module.exports = HistoryEntry;

function HistoryEntry(db, broker)
{
  this.db = db;
  this.broker = broker;

  this.clear();
}

HistoryEntry.prototype.toJSON = function()
{
  return {
    _id: this._id,
    serviceTag: this.serviceTag,
    serviceTagStatus: this.serviceTagStatus,
    driver: this.driver,
    driverStatus: this.driverStatus,
    gprs: this.gprs,
    gprsStatus: this.gprsStatus,
    led: this.led,
    ledStatus: this.ledStatus,
    startedAt: this.startedAt,
    finishedAt: this.finishedAt,
    log: Array.isArray(this.log) ? [].concat(this.log) : null,
    result: this.result,
    errorCode: this.errorCode,
    exception: this.exception,
    output: this.output
  };
};

HistoryEntry.prototype.isProgramming = function()
{
  return this._id !== null && this.finishedAt === null;
};

HistoryEntry.prototype.clear = function()
{
  this._id = null;
  this.serviceTag = null;
  this.serviceTagStatus = 'waiting';
  this.orderFilePath = null;
  this.orderFileHash = null;
  this.orderData = null;
  this.driver = null;
  this.driverStatus = 'waiting';
  this.driverFilePath = null;
  this.driverFileHash = null;
  this.driverData = null;
  this.gprs = null;
  this.gprsStatus = 'waiting';
  this.gprsFilePath = null;
  this.gprsFileHash = null;
  this.gprsData = null;
  this.led = null;
  this.ledStatus = 'waiting';
  this.startedAt = null;
  this.finishedAt = null;
  this.log = null;
  this.result = null;
  this.errorCode = null;
  this.exception = null;
  this.output = null;
  this.inputFileHash = null;
  this.outputFileHash = null;
};

HistoryEntry.prototype.onProgramStart = function()
{
  this.startedAt = Date.now();
  this.log = [{
    time: this.startedAt,
    text: 'PROGRAMMING_STARTED'
  }];
  this._id = (this.startedAt + Math.random()).toString(36).toUpperCase();
  this.finishedAt = null;
  this.result = null;
  this.errorCode = null;
  this.exception = null;
  this.output = null;
  this.inputFileHash = null;
  this.outputFileHash = null;
};

HistoryEntry.prototype.save = function(done)
{
  var sql = "\
    REPLACE INTO historyEntries (\
      _id, serviceTag, orderFilePath, orderFileHash, driver, driverFilePath, driverFileHash,\
      gprs, gprsFilePath, gprsFileHash, led, startedAt, finishedAt, \
      log, result, errorCode, exception, output, inputFileHash, outputFileHash\
    ) VALUES (\
      $_id, $serviceTag, $orderFilePath, $orderFileHash, $driver, $driverFilePath, $driverFileHash,\
      $gprs, $gprsFilePath, $gprsFileHash, $led, $startedAt, $finishedAt, \
      $log, $result, $errorCode, $exception, $output, $inputFileHash, $outputFileHash\
    )";

  var params = {
    $_id: this._id,
    $serviceTag: this.serviceTag,
    $orderFilePath: this.orderFilePath,
    $orderFileHash: this.orderFileHash,
    $driver: this.driver,
    $driverFilePath: this.driverFilePath,
    $driverFileHash: this.driverFileHash,
    $gprs: this.gprs,
    $gprsFilePath: this.gprsFilePath,
    $gprsFileHash: this.gprsFileHash,
    $led: this.led,
    $startedAt: this.startedAt,
    $finishedAt: this.finishedAt,
    $log: JSON.stringify(this.log),
    $result: this.result,
    $errorCode: this.errorCode,
    $exception: this.exception,
    $output: this.output,
    $inputFileHash: this.inputFileHash,
    $outputFileHash: this.outputFileHash
  };

  this.db.run(sql, params, done);
};
