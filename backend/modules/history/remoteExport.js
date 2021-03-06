// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');
var step = require('h5.step');
var request = require('request');
var JSZip = require('jszip');
var ursa = require('ursa');

module.exports = function setUpRemoteExport(app, historyModule)
{
  var db = app[historyModule.config.sqlite3Id].db;
  var settings = app[historyModule.config.settingsId];

  var syncTimer = null;
  var cachedEncryptedUuids = {};

  app.broker.subscribe('app.started', syncNow).setLimit(1);

  function isValidLicense()
  {
    var licenseInfo = settings.get('licenseInfo');

    if (!licenseInfo || !(licenseInfo.features & 1))
    {
      return false;
    }

    if (!licenseInfo.error)
    {
      return true;
    }

    return licenseInfo.error === 'UNKNOWN_LICENSE' || licenseInfo.error === 'DUPLICATE_LICENSE';
  }

  function scheduleNextSync(halve)
  {
    if (syncTimer !== null)
    {
      clearTimeout(syncTimer);
    }

    var syncInterval = settings.get('syncInterval');

    if (typeof syncInterval !== 'number' || isNaN(syncInterval) || syncInterval < 10)
    {
      syncInterval = 10;
    }

    if (halve)
    {
      syncInterval = Math.round(syncInterval / 2);
    }

    syncTimer = setTimeout(syncNow, syncInterval * 60 * 1000);

    historyModule.info("Scheduled the next remote sync to happen in %d minutes!", syncInterval);
  }

  function syncNow()
  {
    historyModule.info("Starting the remote export process...");

    if (!isValidLicense())
    {
      historyModule.warn("Stopping the remote export: invalid license :(");

      return scheduleNextSync(false);
    }

    step(
      pingRemoteServerStep,
      readLastExportTimeStep,
      findHistoryEntriesStep,
      initArchiveStep,
      packFilesStep,
      generateArchiveStep,
      sendArchiveStep,
      saveLastExportTimeStep,
      finalizeStep
    );
  }

  function pingRemoteServerStep()
  {
    /*jshint validthis:true*/

    this.remoteUrl = url.parse(settings.get('remoteServer'));
    this.remoteUrl.pathname = '/ping';

    var pingUrl = url.format(this.remoteUrl);

    historyModule.debug("Pinging the remote server: %s...", pingUrl);

    if (!this.remoteUrl.protocol || !this.remoteUrl.host)
    {
      return this.skip(new Error("invalid remote server setting :("));
    }

    var next = this.next();

    request.head({url: pingUrl}, function(err, res)
    {
      if (err)
      {
        return next(err);
      }

      if (res.statusCode >= 400)
      {
        return next(new Error("remote server returned a " + res.statusCode + " response :("));
      }

      return setImmediate(next);
    });
  }

  function readLastExportTimeStep(err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    historyModule.debug("Reading the last export time...");

    var ctx = this;
    var next = this.next();

    fs.readFile(historyModule.config.lastExportTimeFile, 'utf8', function(err, contents)
    {
      if (err && err.code !== 'ENOENT')
      {
        return next(err);
      }

      var lastExportTime = parseInt(contents, 10);

      if (isNaN(lastExportTime) || lastExportTime < 0)
      {
        lastExportTime = 0;
      }

      ctx.lastExportTime = lastExportTime;

      historyModule.debug("Last export time is %s!", new Date(lastExportTime));

      return setImmediate(next);
    });
  }

  function findHistoryEntriesStep(err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    historyModule.debug("Finding the history entries to export...");

    var ctx = this;
    var next = this.next();
    var sql = "SELECT * FROM historyEntries WHERE startedAt > $startedAt ORDER BY startedAt ASC LIMIT "
      + (historyModule.config.exportLimit + 1);

    db.all(sql, {$startedAt: this.lastExportTime}, function(err, rows)
    {
      if (err)
      {
        return next(err);
      }

      ctx.hasMore = rows.length === (historyModule.config.exportLimit + 1);

      if (ctx.hasMore)
      {
        rows.pop();
      }

      ctx.latestStartedAt = rows.length ? rows[rows.length - 1].startedAt : null;
      ctx.historyEntries = JSON.stringify(rows);
      ctx.fileHashes = {};

      for (var i = 0, l = rows.length; i < l; ++i)
      {
        var row = rows[i];

        ctx.fileHashes[row.orderFileHash] = true;
        ctx.fileHashes[row.driverFileHash] = true;
        ctx.fileHashes[row.gprsFileHash] = true;

        if (row.inputFileHash !== null)
        {
          ctx.fileHashes[row.inputFileHash] = true;
        }

        if (row.outputFileHash !== null)
        {
          ctx.fileHashes[row.outputFileHash] = true;
        }
      }

      historyModule.debug("Found %d history entry(ies) to export!", rows.length);

      return setImmediate(next);
    });
  }

  function initArchiveStep(err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    if (this.latestStartedAt === null)
    {
      return this.skip();
    }

    historyModule.debug("Initializing the archive...");

    var uuid = settings.get('licenseInfo').uuid;

    if (!cachedEncryptedUuids[uuid])
    {
      cachedEncryptedUuids[uuid] = ursa.createPublicKey(settings.config.licenseEdPem).encrypt(uuid, 'utf8', 'base64');
    }

    this.zip = new JSZip();
    this.zip.file('meta.json', JSON.stringify({
      id: settings.get('id'),
      title: settings.get('title'),
      uuid: cachedEncryptedUuids[uuid]
    }));
    this.zip.file('results.json', this.historyEntries);
    this.zip.folder('files');

    this.historyEntries = null;

    setImmediate(this.next());
  }

  function packFilesStep(err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    var fileHashes = Object.keys(this.fileHashes);

    this.fileHashes = null;

    if (fileHashes.length === 0)
    {
      return historyModule.debug("No files to pack!");
    }

    historyModule.debug("Packing %d feature file(s)...", fileHashes.length);

    var filesZip = this.zip.folder('files');

    step(
      function()
      {
        var ctx = this;

        fileHashes.forEach(function(fileHash)
        {
          var featureFilePath = path.join(historyModule.config.storagePath, fileHash);
          var next = ctx.parallel();

          fs.readFile(featureFilePath, function(err, buf)
          {
            if (buf)
            {
              filesZip.file(fileHash, buf);
            }

            return next();
          });
        });
      },
      this.next()
    );
  }

  function generateArchiveStep()
  {
    /*jshint validthis:true*/

    historyModule.debug("Generating the archive file...");

    this.archive = this.zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    historyModule.debug("Generated the archive file (%d bytes)!", this.archive.length);

    this.zip = null;

    setImmediate(this.next());
  }

  function sendArchiveStep()
  {
    /*jshint validthis:true*/

    this.remoteUrl.pathname = '/icpo;import';

    var resultsUrl = url.format(this.remoteUrl);

    historyModule.debug("POSTing the archive to: %s...", resultsUrl);

    var options = {
      url: resultsUrl,
      body: this.archive,
      headers: {
        'content-type': 'application/zip',
        'accepts': 'text/plain'
      },
      qs: {
        uuid: settings.get('licenseInfo').uuid
      }
    };

    this.archive = null;

    var next = this.next();

    request.post(options, function(err, res, body)
    {
      if (err)
      {
        return next(err);
      }

      if (res.statusCode >= 400)
      {
        if (body === 'UNKNOWN_LICENSE' || body === 'DUPLICATE_LICENSE')
        {
          var licenseInfo = settings.get('licenseInfo');

          if (licenseInfo.error !== body)
          {
            licenseInfo.error = body;

            app.broker.publish('settings.changed', {licenseInfo: licenseInfo});
          }
        }

        return next(new Error(
          "remote server returned a " + res.statusCode + " response: " + body
        ));
      }

      return next();
    });
  }

  function saveLastExportTimeStep(err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    var file = historyModule.config.lastExportTimeFile;
    var contents = this.latestStartedAt.toString();

    historyModule.debug("Saving the last export time (%s)...", new Date(this.latestStartedAt));

    fs.writeFile(file, contents, this.next());
  }

  function finalizeStep(err)
  {
    /*jshint validthis:true*/

    this.historyEntries = null;
    this.fileHashes = null;
    this.zip = null;
    this.remoteUrl = null;

    if (err)
    {
      historyModule.error("Failed to export data to the remote server: %s", err.message);
    }
    else
    {
      historyModule.info("Finished exporting data to the remote server!");
    }

    if (!err && this.hasMore)
    {
      setImmediate(syncNow);
    }
    else
    {
      scheduleNextSync(!!err);
    }
  }
};
