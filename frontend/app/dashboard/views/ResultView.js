// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'app/core/View',
  'app/history/util/decorateLogEntry',
  'app/dashboard/templates/result'
], function(
  View,
  decorateLogEntry,
  template
) {
  'use strict';

  return View.extend({

    template: template,

    serialize: function()
    {
      return {
        log: this.model.get('log').map(decorateLogEntry)
      };
    }

  });
});
