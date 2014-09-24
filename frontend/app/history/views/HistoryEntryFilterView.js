// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'underscore',
  'js2form',
  'app/i18n',
  'app/time',
  'app/core/View',
  'app/history/templates/filter'
], function(
  _,
  js2form,
  t,
  time,
  View,
  filterTemplate
) {
  'use strict';

  return View.extend({

    template: filterTemplate,

    events: {
      'submit .filter-form': function(e)
      {
        e.preventDefault();

        this.changeFilter();
      }
    },

    initialize: function()
    {
      this.idPrefix = _.uniqueId('v');
    },

    serialize: function()
    {
      return {
        idPrefix: this.idPrefix
      };
    },

    afterRender: function()
    {
      var formData = this.serializeRqlQuery();

      js2form(this.el.querySelector('.filter-form'), formData);

      if (formData.result.length === 1)
      {
        this.$('.history-filter-' + formData.result[0]).addClass('active');
      }
      else
      {
        this.$('.history-filter-result > label').addClass('active');
      }
    },

    serializeRqlQuery: function()
    {
      var datetimeFormat = this.$id('from').prop('type') === 'datetime-local'
        ? 'YYYY-MM-DDTHH:mm:ss'
        : 'YYYY-MM-DD HH:mm';
      var rqlQuery = this.model.rqlQuery;
      var formData = {
        from: '',
        to: '',
        serviceTag: '',
        driver: '',
        gprs: '',
        led: '',
        result: ['success', 'failure'],
        limit: rqlQuery.limit < 5 ? 5 : (rqlQuery.limit > 100 ? 100 : rqlQuery.limit)
      };

      rqlQuery.selector.args.forEach(function(term)
      {
        /*jshint -W015*/

        var property = term.args[0];

        switch (property)
        {
          case 'startedAt':
            formData[term.name === 'ge' ? 'from' : 'to'] =
              time.format(term.args[1], datetimeFormat);
            break;

          case 'serviceTag':
          case 'driver':
          case 'gprs':
          case 'led':
            formData[property] = term.args[1];
            break;

          case 'result':
            if (term.args[1] === 'success' || term.args[1] === 'failure')
            {
              formData.result = [term.args[1]];
            }
            break;
        }
      });

      return formData;
    },

    changeFilter: function()
    {
      var rqlQuery = this.model.rqlQuery;
      var selector = [];
      var fromMoment = time.getMoment(this.$id('from').val());
      var toMoment = time.getMoment(this.$id('to').val());
      var serviceTag = this.$id('serviceTag').val().trim();
      var driver = this.$id('driver').val().trim();
      var gprs = this.$id('gprs').val().trim();
      var led = this.$id('led').val().trim();
      var $result = this.$('input[name="result[]"]:checked');

      if (serviceTag.length)
      {
        selector.push({name: 'eq', args: ['serviceTag', serviceTag]});
      }

      if (driver.length)
      {
        selector.push({name: 'eq', args: ['driver', driver]});
      }

      if (gprs.length)
      {
        selector.push({name: 'eq', args: ['gprs', gprs]});
      }

      if (led.length)
      {
        selector.push({name: 'eq', args: ['led', led]});
      }

      if (fromMoment.isValid())
      {
        selector.push({name: 'ge', args: ['startedAt', fromMoment.valueOf()]});
      }

      if (toMoment.isValid())
      {
        selector.push({name: 'lt', args: ['startedAt', toMoment.valueOf()]});
      }

      if ($result.length === 1)
      {
        selector.push({name: 'eq', args: ['result', $result.val()]});
      }

      rqlQuery.selector = {name: 'and', args: selector};
      rqlQuery.limit = parseInt(this.$id('limit').val(), 10) || 20;
      rqlQuery.skip = 0;

      this.trigger('filterChanged', rqlQuery);
    }

  });
});
