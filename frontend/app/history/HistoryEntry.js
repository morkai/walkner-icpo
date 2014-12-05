// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  '../socket',
  '../core/Model',
  './util/decorateLogEntry'
], function(
  socket,
  Model,
  decorateLogEntry
) {
  'use strict';

  return Model.extend({

    urlRoot: '/history',

    clientUrlRoot: '#history',

    topicPrefix: 'history',

    nlsDomain: 'history',

    isProgramming: function()
    {
      return this.get('_id') !== null && this.get('finishedAt') === null;
    },

    isInputDataLoaded: function()
    {
      return this.get('serviceTagStatus') === 'loaded'
        && this.get('driverStatus') === 'loaded'
        && this.get('gprsStatus') === 'loaded'
        && this.get('ledStatus') === 'loaded';
    },

    isInputDataLoading: function(property)
    {
      return this.get(property + 'Status') === 'loading';
    },

    isInputDataError: function(property)
    {
      return /^error/.test(this.get(property + 'Status'));
    },

    pushLogEntry: function(logEntry)
    {
      var log = this.get('log');

      if (Array.isArray(log))
      {
        log.push(logEntry);

        this.trigger('push:log', logEntry);
      }
    },

    getDecoratedLog: function()
    {
      var log = this.get('log');

      if (typeof log === 'string')
      {
        log = JSON.parse(log);
      }

      return Array.isArray(log) ? log.map(decorateLogEntry) : [];
    }

  });
});
