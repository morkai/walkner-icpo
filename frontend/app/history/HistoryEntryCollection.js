// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  '../time',
  '../core/Collection',
  './HistoryEntry'
], function(
  time,
  Collection,
  HistoryEntry
) {
  'use strict';

  return Collection.extend({

    model: HistoryEntry,

    rqlQuery: function(rql)
    {
      var sevenDaysAgo = time.getMoment()
        .hours(6)
        .minutes(0)
        .seconds(0)
        .milliseconds(0)
        .subtract('days', 7)
        .valueOf();

      return rql.Query.fromObject({
        fields: {
          _id: 1,
          serviceTag: 1,
          driver: 1,
          gprs: 1,
          led: 1,
          result: 1,
          startedAt: 1,
          finishedAt: 1
        },
        sort: {
          startedAt: -1
        },
        limit: 20,
        selector: {
          name: 'and',
          args: [
            {name: 'ge', args: ['startedAt', sevenDaysAgo]}
          ]
        }
      });
    }

  });
});
