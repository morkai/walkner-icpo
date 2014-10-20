// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'app/i18n',
  'app/time',
  'app/core/views/ListView'
], function(
  t,
  time,
  ListView
) {
  'use strict';

  return ListView.extend({

    remoteTopics: {
      'programmer.finished': 'refreshCollection'
    },

    events: {
      'click .list-item': function(e)
      {
        this.broker.publish('router.navigate', {
          url: this.collection.get(e.currentTarget.dataset.id).genClientUrl(),
          trigger: true,
          replace: false
        });
      }
    },

    columns: ['serviceTag', 'driver', 'gprs', 'led', 'startedAt', 'duration'],

    serializeActions: function()
    {
      return null;
    },

    serializeRow: function(model)
    {
      return {
        _id: model.id,
        className: 'history-entry ' + (model.get('result') === 'success' ? 'success' : 'danger'),
        serviceTag: model.get('serviceTag'),
        driver: model.get('driver'),
        gprs: model.get('gprs'),
        led: model.get('led'),
        startedAt: time.format(model.get('startedAt'), 'YYYY-MM-DD, HH:mm:ss.SSS'),
        duration: time.toString((model.get('finishedAt') - model.get('startedAt')) / 1000, false, true)
      };
    }

  });
});
