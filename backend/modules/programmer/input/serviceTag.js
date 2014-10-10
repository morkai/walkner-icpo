// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

var createHash = require('crypto').createHash;
var path = require('path');
var fs = require('fs');
var readFile = require('../readFile');

module.exports = function setUpServiceTagInput(app, programmerModule)
{
  var settings = app[programmerModule.config.settingsId];
  var currentState = programmerModule.currentState;

  function error(reason)
  {
    programmerModule.changeState({serviceTagStatus: 'error:' + reason});
  }

  return function loadServiceTagData()
  {
    var orderNo = currentState.serviceTag.substr(4, 9);
    var orderFile = orderNo + '.dat';
    var orderFilePath = path.join(settings.get('orderPath'), orderFile);

    readFile(orderFilePath, settings.get('readTimeout'), function(err, orderFileContents)
    {
      if (err)
      {
        programmerModule.error("Failed to read order DAT [%s]: %s", orderFilePath, err.message);

        return error(err.code === 'ENOENT' ? 'notFound' : 'readFile');
      }

      if (orderFileContents === false)
      {
        return error('timeout:readFile');
      }

      var lines = orderFileContents.split(/(\r\n|\n|\r)+/);
      var rawOrderData = {};

      for (var i = 0, l = lines.length; i < l; ++i)
      {
        var line = lines[i];
        var colonPos = line.indexOf(':');

        if (colonPos === -1)
        {
          continue;
        }

        var property = line.substr(0, colonPos).trim().toLowerCase();

        if (property === '')
        {
          continue;
        }

        rawOrderData[property] = line.substr(colonPos + 1).trim();
      }

      var orderData = {
        productDefinition: null,
        configurationDesignation: null,
        productName: null,
        productionLocation: null,
        systemPower: null,
        productClass: null,
        luminousFlux: null,
        colorRenderingIndex: null,
        optics: null,
        salesOrder: {
          orderNumber: null,
          orderLineNumber: null,
          orderLineQty: null
        },
        lightColor: null,
        ambientTemperatureRating: null
      };

      if (rawOrderData['material number'])
      {
        orderData.productDefinition = rawOrderData['material number'].trim();
      }

      if (!orderData.productDefinition)
      {
        return error('data:productDefinition');
      }

      if (rawOrderData['commercial designation'])
      {
        orderData.configurationDesignation = rawOrderData['commercial designation'].trim();
      }

      if (!orderData.configurationDesignation)
      {
        return error('data:configurationDesignation');
      }

      var matches = orderData.configurationDesignation.match(/(?:GRN|ECO)([0-9]+)[-\s]*\/[-\s]*([0-9]{3})/);

      if (matches === null)
      {
        return error('data:configurationDesignation');
      }

      var lampType = matches[0];

      orderData.luminousFlux = parseInt(matches[1], 10) * 100;
      orderData.colorRenderingIndex = parseInt(matches[2][0], 10) * 10;
      orderData.lightColor = parseInt(matches[2].substr(1), 10) * 100;

      matches = orderData.configurationDesignation.match(/(I+V?I*)\s+([A-Z0-9]+)/);

      if (matches === null)
      {
        var lampTypePos = orderData.configurationDesignation.indexOf(lampType);
        var parts = orderData.configurationDesignation.substr(lampTypePos + lampType.length).trim().split(/\s+/);

        orderData.productClass = 'I';
        orderData.optics = parts[0];
      }
      else
      {
        orderData.productClass = matches[1];
        orderData.optics = matches[2];
      }

      if (rawOrderData['product family name'])
      {
        orderData.productName = rawOrderData['product family name'].trim();
      }

      if (!orderData.productName)
      {
        return error('data:productName');
      }

      if (rawOrderData['country of origin/ made in'])
      {
        orderData.productionLocation = rawOrderData['country of origin/ made in'].trim();
      }

      if (!orderData.productionLocation)
      {
        return error('data:productionLocation');
      }

      if (rawOrderData['special designation'])
      {
        orderData.systemPower = parseFloat(rawOrderData['special designation'].trim().replace(',', '.'));
      }

      if (orderData.systemPower === null || isNaN(orderData.systemPower))
      {
        return error('data:systemPower');
      }

      orderData.salesOrder.orderNumber = parseInt(rawOrderData['sales order number'], 10);

      if (isNaN(orderData.salesOrder.orderNumber))
      {
        return error('data:orderNumber');
      }

      orderData.salesOrder.orderLineNumber = parseInt(rawOrderData['sales order item number'], 10);

      if (isNaN(orderData.salesOrder.orderLineNumber))
      {
        return error('data:orderLineNumber');
      }

      orderData.salesOrder.orderLineQty = parseInt(rawOrderData['production order quantity'], 10);

      if (isNaN(orderData.salesOrder.orderLineQty))
      {
        return error('data:orderLineQty');
      }

      orderData.ambientTemperatureRating = parseInt((rawOrderData.temperature || '').replace(/[^0-9]/g, ''), 10);

      if (isNaN(orderData.ambientTemperatureRating))
      {
        return error('data:ambientTemperatureRating');
      }

      currentState.orderFilePath = orderFilePath;
      currentState.orderFileHash = createHash('md5').update(orderFileContents).digest('hex');

      var localFilePath = path.join(programmerModule.config.storagePath, currentState.orderFileHash);

      fs.writeFile(localFilePath, orderFileContents, function(err)
      {
        if (err)
        {
          programmerModule.error("Failed to write order DAT [%s]: %s", localFilePath, err.message);

          return error('writeFile');
        }

        currentState.orderData = orderData;

        programmerModule.changeState({serviceTagStatus: 'loaded'});
      });
    });
  };
};
