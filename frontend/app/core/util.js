// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'underscore'
], function(
  _
) {
  'use strict';

  var util = {};

  /**
   * @param {Function} ctor
   * @param {Function} superCtor
   * @returns {Function}
   */
  util.inherits = function(ctor, superCtor)
  {
    _.extend(ctor, superCtor);

    var Surrogate = function() { this.constructor = ctor; };
    Surrogate.prototype = superCtor.prototype;
    ctor.prototype = new Surrogate();

    ctor.__super__ = superCtor.prototype;

    return ctor;
  };

  /**
   * @param {string} uriComponent
   * @returns {string}
   */
  util.decodeUriComponent = function(uriComponent)
  {
    return decodeURIComponent(uriComponent.replace(/\+/g, ' '));
  };

  /**
   * @param {object} obj
   * @param {string} propertyName
   * @param {{sandbox: function}} parent
   */
  util.defineSandboxedProperty = function(obj, propertyName, parent)
  {
    if (!_.isObject(obj._sandboxedProperties))
    {
      obj._sandboxedProperties = {};
    }

    var sandboxedProperties = obj._sandboxedProperties;
    var option = obj.options[propertyName];

    if (_.isObject(option))
    {
      sandboxedProperties[propertyName] = option;
      obj[propertyName] = option;

      delete obj.options[propertyName];

      return;
    }
    else
    {
      sandboxedProperties[propertyName] = null;
    }

    Object.defineProperty(obj, propertyName, {
      enumerable: true,
      configurable: true,
      get: function()
      {
        if (sandboxedProperties[propertyName] === null)
        {
          sandboxedProperties[propertyName] = parent.sandbox();
        }

        return sandboxedProperties[propertyName];
      },
      set: function(value)
      {
        this[propertyName] = value;
      }
    });
  };

  /**
   * @param {object} obj
   */
  util.cleanupSandboxedProperties = function(obj)
  {
    var sandboxedProperties = obj._sandboxedProperties;

    if (!_.isObject(sandboxedProperties))
    {
      return;
    }

    var propertyNames = Object.keys(sandboxedProperties);

    propertyNames.forEach(function(propertyName)
    {
      var sandboxedProperty = sandboxedProperties[propertyName];

      if (sandboxedProperty && _.isFunction(sandboxedProperty.destroy))
      {
        sandboxedProperty.destroy();
      }
    });

    obj._sandboxedProperties = null;
  };

  /**
   * @param {object} obj
   * @param {string} brokerProperty
   * @param {object.<string, function|string>|function(): object.<string, function|string>} topics
   * @param {boolean} bind
   */
  util.subscribeTopics = function(obj, brokerProperty, topics, bind)
  {
    if (_.isFunction(topics))
    {
      topics = topics.call(obj);
    }

    if (!_.isObject(topics) || !_.size(topics))
    {
      return;
    }

    var broker = obj[brokerProperty];

    _.each(topics, function subscribeTopic(onMessage, topic)
    {
      if (_.isString(onMessage))
      {
        onMessage = obj[onMessage];
      }

      if (bind)
      {
        onMessage = onMessage.bind(obj);
      }

      broker.subscribe(topic, onMessage);
    });
  };

  /**
   * @param {string} string
   * @returns {string}
   */
  util.escapeRegExp = function(string)
  {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  };

  return util;
});
