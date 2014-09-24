// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'app/i18n',
  'app/core/util/bindLoadingMessage',
  'app/core/View',
  '../HistoryEntry',
  '../views/HistoryEntryDetailsView',
  'app/history/templates/downloadAction'
], function(
  t,
  bindLoadingMessage,
  View,
  HistoryEntry,
  HistoryEntryDetailsView,
  downloadActionTemplate
) {
  'use strict';

  return View.extend({

    layoutName: 'page',

    pageId: 'historyEntryDetails',

    breadcrumbs: function()
    {
      return [
        {
          label: t.bound('history', 'BREADCRUMBS:browse'),
          href: this.model.genClientUrl('base')
        },
        t.bound('history', 'BREADCRUMBS:details')
      ];
    },

    actions: function()
    {
      var model = this.model;
      var url = model.url() + ';';

      return [{
        template: function()
        {
          var files = {};

          ['orderData', 'driverData', 'gprsData', 'inputData', 'outputData'].forEach(function(type)
          {
            var data = model.get(type);

            files[type] = data && data.length ? (url + type) : null;
          });

          return downloadActionTemplate({files: files});
        }
      }];
    },

    initialize: function()
    {
      this.model = bindLoadingMessage(new HistoryEntry({_id: this.options.modelId}), this);

      this.view = new HistoryEntryDetailsView({
        model: this.model,
        tab: this.options.tab
      });
    },

    load: function(when)
    {
      return when(this.model.fetch());
    }

  });
});
