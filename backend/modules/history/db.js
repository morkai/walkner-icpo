// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

module.exports = function setUpHistoryDb(db, done)
{
  var sql = 'BEGIN TRANSACTION;\
CREATE TABLE IF NOT EXISTS historyEntries (\
  _id TEXT PRIMARY KEY NOT NULL,\
  serviceTag TEXT NOT NULL,\
  orderFilePath TEXT NOT NULL,\
  orderFileHash TEXT NOT NULL,\
  driver TEXT NOT NULL,\
  driverFilePath TEXT NOT NULL,\
  driverFileHash TEXT NOT NULL,\
  gprs TEXT NOT NULL,\
  gprsFilePath TEXT NOT NULL,\
  gprsFileHash TEXT NOT NULL,\
  led TEXT NOT NULL,\
  startedAt INT NOT NULL,\
  finishedAt INT NOT NULL,\
  log TEXT NOT NULL,\
  result TEXT NOT NULL,\
  errorCode TEXT,\
  exception TEXT,\
  output TEXT,\
  inputFileHash TEXT,\
  outputFileHash TEXT\
) WITHOUT ROWID;\
CREATE INDEX IF NOT EXISTS startedAt_D ON historyEntries(startedAt DESC);\
CREATE INDEX IF NOT EXISTS serviceTag_A_startedAt_D ON historyEntries(serviceTag ASC, startedAt DESC);\
CREATE INDEX IF NOT EXISTS driver_A_startedAt_D ON historyEntries(driver ASC, startedAt DESC);\
CREATE INDEX IF NOT EXISTS gprs_A_startedAt_D ON historyEntries(gprs ASC, startedAt DESC);\
CREATE INDEX IF NOT EXISTS led_A_startedAt_D ON historyEntries(led ASC, startedAt DESC);\
CREATE INDEX IF NOT EXISTS result_A_startedAt_D ON historyEntries(result ASC, startedAt DESC);\
COMMIT TRANSACTION;';

  db.exec(sql, done);
};
