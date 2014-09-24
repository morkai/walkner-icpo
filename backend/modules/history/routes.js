// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var csv = require('csv');
var step = require('h5.step');

module.exports = function setUpHistoryRoutes(app, historyModule)
{
  var TERM_TO_CONDITION = {
    eq: '=',
    ne: '<>',
    lt: '<',
    le: '<=',
    gt: '>',
    ge: '>=',
    in: true
  };
  var PROPERTY_TO_FIELD = {
    _id: true,
    serviceTag: true,
    orderFilePath: true,
    orderFileHash: true,
    driver: true,
    driverFilePath: true,
    driverFileHash: true,
    gprs: true,
    gprsFilePath: true,
    gprsFileHash: true,
    led: true,
    startedAt: true,
    finishedAt: true,
    log: true,
    result: true,
    errorCode: true,
    exception: true,
    output: true,
    inputFileHash: true,
    outputFileHash: true
  };

  var express = app[historyModule.config.expressId];
  var db = app[historyModule.config.sqlite3Id].db;

  express.get('/history', prepareSql, function(req, res, next)
  {
    step(
      function()
      {
        var sql = "SELECT COUNT(*) AS totalCount\
                   FROM historyEntries\
                   WHERE " + req.sql.conditions;

        db.get(sql, this.next());
      },
      function(err, row)
      {
        if (err)
        {
          return this.skip(err);
        }

        this.totalCount = row.totalCount;

        if (row.totalCount === 0)
        {
          return this.skip(null, []);
        }
      },
      function()
      {
        var sql = "SELECT " + req.sql.fields + "\
                   FROM historyEntries\
                   WHERE " + req.sql.conditions + "\
                   ORDER BY " + req.sql.orderBy + "\
                   LIMIT " + req.sql.limit + " OFFSET " + req.sql.offset;

        db.all(sql, this.next());
      },
      function(err, rows)
      {
        if (err)
        {
          return next(err);
        }

        res.send({
          totalCount: this.totalCount,
          collection: rows
        });
      }
    );
  });

  express.get('/history;export', setExportFields, prepareSql, function(req, res, next)
  {
    var sql = "SELECT " + req.sql.fields + "\
               FROM historyEntries\
               WHERE " + req.sql.conditions + "\
               ORDER BY " + req.sql.orderBy;

    db.all(sql, function(err, rows)
    {
      if (err)
      {
        return next(err);
      }

      res.type('csv');
      res.attachment('icpo-results.csv');

      if (rows.length === 0)
      {
        return res.end();
      }

      res.write(new Buffer([0xEF, 0xBB, 0xBF]));

      var columns = Object.keys(rows[0]);
      columns.push('duration');

      csv()
        .from.array(rows)
        .to.stream(res, {
          header: true,
          columns: columns,
          rowDelimiter: '\r\n',
          delimiter: ';',
          quote: '"'
        })
        .transform(function(row)
        {
          row.duration = row.finishedAt - row.startedAt;

          formatDateTime(row, 'startedAt');
          formatDateTime(row, 'finishedAt');
          formatDuration(row, 'duration');

          return row;
        })
        .on('error', next);
    });
  });

  express.get('/history;recent', function(req, res)
  {
    res.send({
      totalCount: historyModule.recent.length,
      collection: historyModule.recent
    });
  });

  express.get('/history/:id;orderData', downloadFileRoute.bind(null, 'order'));
  express.get('/history/:id;driverData', downloadFileRoute.bind(null, 'driver'));
  express.get('/history/:id;gprsData', downloadFileRoute.bind(null, 'gprs'));
  express.get('/history/:id;inputData', downloadFileRoute.bind(null, 'input'));
  express.get('/history/:id;outputData', downloadFileRoute.bind(null, 'output'));

  express.get('/history/:id', function(req, res, next)
  {
    var sql = "SELECT * FROM historyEntries WHERE _id=$_id LIMIT 1";

    db.get(sql, {$_id: req.params.id}, function(err, row)
    {
      if (err)
      {
        return next(err);
      }

      if (!row)
      {
        return res.send(404);
      }

      step(
        function()
        {
          fs.readFile(path.join(historyModule.config.storagePath, row.orderFileHash || ''), 'utf8', this.parallel());
          fs.readFile(path.join(historyModule.config.storagePath, row.driverFileHash || ''), 'utf8', this.parallel());
          fs.readFile(path.join(historyModule.config.storagePath, row.gprsFileHash || ''), 'utf8', this.parallel());
          fs.readFile(path.join(historyModule.config.storagePath, row.inputFileHash || ''), 'utf8', this.parallel());
          fs.readFile(path.join(historyModule.config.storagePath, row.outputFileHash || ''), 'utf8', this.parallel());
        },
        function(err, orderData, driverData, gprsData, inputData, outputData)
        {
          row.orderData = orderData;
          row.driverData = driverData;
          row.gprsData = gprsData;
          row.inputData = inputData;
          row.outputData = outputData;

          return res.json(row);
        }
      );
    });
  });

  function downloadFileRoute(file, req, res, next)
  {
    var fields = ['serviceTag', file + 'FileHash AS fileHash'];

    if (PROPERTY_TO_FIELD[file + 'FilePath'])
    {
      fields.push(file + 'FilePath AS filePath');
    }

    var sql = "SELECT " + fields.join(', ') + " FROM historyEntries WHERE _id=$_id LIMIT 1";

    db.get(sql, {$_id: req.params.id}, function(err, row)
    {
      if (err)
      {
        return next(err);
      }

      if (!row)
      {
        return res.send(404);
      }

      var mimeType;
      var fileName;

      switch (file)
      {
        case 'order':
          mimeType = 'text/plain';
          fileName = path.basename(row.filePath);
          break;

        case 'driver':
        case 'gprs':
          mimeType = 'xml';
          fileName = path.basename(row.filePath);
          break;

        case 'input':
          mimeType = 'json';
          fileName = row.serviceTag.substr(4) + '.json';
          break;

        case 'output':
          mimeType = 'xml';
          fileName = row.serviceTag.substr(4) + '.xml';
          break;
      }

      res.type(mimeType);
      res.attachment(fileName);
      res.sendfile(path.join(historyModule.config.storagePath, row.fileHash || ''));
    });
  }

  function setExportFields(req, res, next)
  {
    req.rql.fields = {
      serviceTag: 1,
      driver: 1,
      gprs: 1,
      led: 1,
      result: 1,
      errorCode: 1,
      exception: 1,
      startedAt: 1,
      finishedAt: 1
    };

    return next();
  }

  function prepareSql(req, res, next)
  {
    var fields = [];
    var conditions = prepareSqlConditions(req.rql.selector);
    var orderBy = [];

    Object.keys(req.rql.fields).forEach(function(field)
    {
      if (PROPERTY_TO_FIELD[field])
      {
        fields.push(field);
      }
    });

    Object.keys(req.rql.sort).forEach(function(field)
    {
      if (!PROPERTY_TO_FIELD[field])
      {
        return;
      }

      var asIndex = field.indexOf(' AS ');

      if (asIndex !== -1)
      {
        field = field.substr(0, asIndex);
      }

      orderBy.push(field + ' ' + (req.rql.sort[field] > 0 ? 'ASC' : 'DESC'));
    });

    req.sql = {
      fields: fields.length ? fields.join(', ') : Object.keys(PROPERTY_TO_FIELD).join(', '),
      conditions: conditions.length ? conditions.join(' AND ') : '1=1',
      orderBy: orderBy.length ? orderBy.join(', ') : 'startedAt DESC',
      limit: req.rql.limit,
      offset: req.rql.skip
    };

    next();
  }

  function prepareSqlConditions(selector)
  {
    var conditions = [];

    if (selector.name !== 'and')
    {
      return conditions;
    }

    selector.args.forEach(function(term)
    {
      var condition = TERM_TO_CONDITION[term.name];

      if (!condition)
      {
        return;
      }

      var field = term.args[0];

      if (!PROPERTY_TO_FIELD[field])
      {
        return;
      }

      if (term.name === 'in')
      {
        if (!Array.isArray(term.args[1]))
        {
          return;
        }

        conditions.push(field + ' IN(' + term.args[1].map(quote).join(', ') + ')');
      }
      else
      {
        conditions.push(field + condition + quote(term.args[1]));
      }
    });

    return conditions;
  }

  function quote(value)
  {
    if (typeof value === 'number' || value === null)
    {
      return value;
    }

    if (typeof value === 'boolean')
    {
      return value ? 1 : 0;
    }

    return '"' + String(value).replace(/"/g, '\\"') + '"';
  }

  function formatDateTime(obj, property)
  {
    if (typeof obj[property] === 'number')
    {
      obj[property] = moment(obj[property]).format('YYYY-MM-DD HH:mm:ss');
    }
  }

  function formatDuration(obj, property)
  {
    if (typeof obj[property] === 'number')
    {
      obj[property] = (obj[property] / 1000).toFixed(3).replace('.', ',');
    }
  }
};
