// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

define([
  'underscore',
  'jquery',
  'app/i18n',
  'app/user',
  'app/viewport',
  'app/core/View',
  'app/data/settings',
  'app/data/currentState',
  'app/dashboard/templates/input'
], function(
  _,
  $,
  t,
  user,
  viewport,
  View,
  settings,
  currentState,
  inputTemplate
) {
  'use strict';

  var MODE_STORAGE_KEY = 'INPUT:MODE';
  var FAILURE_MSG_TIME = 3000;
  var SUCCESS_MSG_TIME = 1500;

  return View.extend({

    template: inputTemplate,

    events: {
      'submit': 'onFormSubmit',
      'keyup .form-control': function(e)
      {
        this.updateInputLength(this.$(e.target));

        if (!this.model.isInputDataLoading(e.target.name) && e.target.value !== this.model.get(e.target.name))
        {
          this.model.set(e.target.name + 'Status', 'waiting');
        }
      },
      'focus .form-control': function()
      {
        this.inputFocused = true;
      },
      'blur .form-control': function()
      {
        this.inputFocused = false;
      }
    },

    localTopics: {
      'hotkeys.focusServiceTag': function() { this.focusElement('serviceTag'); },
      'hotkeys.focusDriver': function() { this.focusElement('driver'); },
      'hotkeys.focusGprs': function() { this.focusElement('gprs'); },
      'hotkeys.focusLed': function() { this.focusElement('led'); },
      'hotkeys.toggleMode': function(){ this.clickElement('mode'); },
      'hotkeys.program': function() { this.clickElement('program'); },
      'hotkeys.cancel': function() { this.clickElement('cancel'); }
    },

    initialize: function()
    {
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyPress = this.onKeyPress.bind(this);
      this.clearCommandBuffer = this.clearCommandBuffer.bind(this);
      this.inputFocused = false;
      this.commandBuffer = '';
      this.idPrefix = _.uniqueId('input');
      this.$els = {
        mode: null,
        program: null,
        cancel: null,
        progress: null,
        inputs: null,
        serviceTag: null,
        quantity: null,
        grps: null,
        led: null,
        window: $(window)
      };
      this.mode = localStorage.getItem(MODE_STORAGE_KEY) || 'manual';

      this.listenTo(this.model, 'change', _.debounce(this.onModelChange.bind(this), 16));
      this.listenTo(this.model, 'change:serviceTag', this.onInputValueChange.bind(this, 'serviceTag'));
      this.listenTo(this.model, 'change:serviceTagStatus', this.onInputStatusChange.bind(this, 'serviceTag'));
      this.listenTo(this.model, 'change:driver', this.onInputValueChange.bind(this, 'driver'));
      this.listenTo(this.model, 'change:driverStatus', this.onInputStatusChange.bind(this, 'driver'));
      this.listenTo(this.model, 'change:gprs', this.onInputValueChange.bind(this, 'gprs'));
      this.listenTo(this.model, 'change:gprsStatus', this.onInputStatusChange.bind(this, 'gprs'));
      this.listenTo(this.model, 'change:led', this.onInputValueChange.bind(this, 'led'));
      this.listenTo(this.model, 'change:ledStatus', this.onInputStatusChange.bind(this, 'led'));
      this.listenTo(this.model, 'change:progress', this.onProgressChange);

      if (user.isLocal())
      {
        this.$els.window.on('keydown', this.onKeyDown);
        this.$els.window.on('keypress', this.onKeyPress);
      }
    },

    destroy: function()
    {
      if (user.isLocal())
      {
        this.$els.window.off('keydown', this.onKeyDown);
        this.$els.window.off('keypress', this.onKeyPress);
      }

      this.$els.mode.remove();
      this.$els = null;
    },

    serialize: function()
    {
      return {
        idPrefix: this.idPrefix,
        className: 'is-' + this.mode,
        modeClassName: this.mode === 'auto' ? 'btn-success' : 'btn-warning',
        modeLabel: t('dashboard', 'input:mode:' + this.mode)
      };
    },

    beforeRender: function()
    {
      if (this.$els.mode)
      {
        this.$els.mode.remove();
      }
    },

    afterRender: function()
    {
      this.$els.inputs = this.$('input');
      this.$els.serviceTag = this.$els.inputs.filter('[name=serviceTag]');
      this.$els.driver = this.$els.inputs.filter('[name=driver]');
      this.$els.gprs = this.$els.inputs.filter('[name=gprs]');
      this.$els.led = this.$els.inputs.filter('[name=led]');
      this.$els.program = this.$('.dashboard-input-program');
      this.$els.cancel = this.$('.dashboard-input-cancel');
      this.$els.progress = this.$('.dashboard-input-progress');
      this.$els.mode = this.$('.dashboard-input-mode')
        .appendTo('body')
        .click(this.onModeClick.bind(this))
        .focus(this.onModeFocus.bind(this));

      this.updateValues();
      this.toggleControls();
      this.toggleInputStatuses();
    },

    focusElement: function(elId)
    {
      var $el = this.$els[elId];

      if ($el && !$el.prop('disabled'))
      {
        $el.focus().select();
      }
    },

    clickElement: function(elId)
    {
      var $el = this.$els[elId];

      if ($el && !$el.prop('disabled') && $el.is(':visible'))
      {
        $el.focus().click();
      }
    },

    toggleMode: function()
    {
      if (!this.$els.mode.is(':visible'))
      {
        return;
      }

      this.$el.removeClass('is-' + this.mode);

      if (this.mode === 'auto')
      {
        this.$els.mode.removeClass('btn-success').addClass('btn-warning');

        this.mode = 'manual';
      }
      else
      {
        this.$el.removeClass('is-auto');
        this.$els.mode.removeClass('btn-warning').addClass('btn-success');

        this.mode = 'auto';
      }

      this.$els.mode.text(t('dashboard', 'input:mode:' + this.mode));
      this.$el.addClass('is-' + this.mode);

      localStorage.setItem(MODE_STORAGE_KEY, this.mode);
    },

    toggleControls: function()
    {
      if (!this.$els)
      {
        return;
      }

      var isProgramming = this.model.isProgramming();

      if (user.isLocal() && !this.model.get('result'))
      {
        var progOrAuto = isProgramming || this.mode === 'auto';

        this.$els.serviceTag.prop('disabled', progOrAuto || this.model.isInputDataLoading('serviceTag'));
        this.$els.driver.prop('disabled', progOrAuto || this.model.isInputDataLoading('driver'));
        this.$els.gprs.prop('disabled', progOrAuto || this.model.isInputDataLoading('gprs'));
        this.$els.led.prop('disabled', progOrAuto || this.model.isInputDataLoading('led'));
        this.$els.program.prop('disabled', progOrAuto || !this.model.isInputDataLoaded());
        this.$els.cancel.prop('disabled', !isProgramming);
        this.$els.mode.show();
      }
      else
      {
        this.$els.inputs.prop('disabled', true);
        this.$els.program.prop('disabled', true);
        this.$els.cancel.prop('disabled', true);
        this.$els.mode.hide();
      }

      this.$els.program.toggle(!isProgramming);
      this.$els.cancel.toggle(isProgramming);
      this.$els.progress.toggle(isProgramming);
    },

    toggleInputStatuses: function()
    {
      this.toggleInputStatus('serviceTag');
      this.toggleInputStatus('driver');
      this.toggleInputStatus('gprs');
      this.toggleInputStatus('led');
    },

    toggleInputStatus: function(inputProperty)
    {
      var $status = this.$id(inputProperty).find('.dashboard-input-status');
      var $indicator = $status.find('.fa');
      var newStatus = this.model.get(inputProperty + 'Status');

      $indicator
        .removeClass('fa-meh-o fa-smile-o fa-frown-o')
        .toggleClass('fa-spin', newStatus === 'loading');

      $status.popover('destroy');

      if (newStatus === 'waiting' || newStatus === 'loading')
      {
        $indicator.addClass('fa-meh-o');
      }
      else if (newStatus === 'loaded')
      {
        $indicator.addClass('fa-smile-o');

        this.checkAutoProgramStart();
      }
      else
      {
        $indicator.addClass('fa-frown-o');

        var content = newStatus;

        if (t.has('dashboard', newStatus))
        {
          content = t.bound('dashboard', newStatus);
        }
        else if (/^error:/.test(newStatus))
        {
          var parts = newStatus.split(':');
          var key = parts[0] + ':' + parts[1];

          if (t.has('dashboard', key))
          {
            content = t('dashboard', key, {data: parts[2]});
          }
        }

        $status.popover({
          trigger: 'manual',
          placement: 'top',
          html: true,
          content: content
        });

        $status.data('bs.popover').tip().addClass('dashboard-input-error');

        $status.popover('show');
      }
    },

    checkAutoProgramStart: function()
    {
      if (user.isLocal()
        && this.mode === 'auto'
        && !this.model.isProgramming()
        && this.model.isInputDataLoaded())
      {
        this.program();
      }
    },

    inputValue: function(property)
    {
      var view = this;
      var value = this.$id(property).find('.form-control').val().trim();
      var changes = {};

      changes[property] = value;
      changes[property + 'Status'] = 'loading';

      this.socket.emit('programmer.input', property, value, function(err)
      {
        if (err)
        {
          view.toggleControls();
          view.toggleInputStatuses();
        }
      });
    },

    updateInputLength: function($input)
    {
      $input.attr('data-length', $input.val().length);
    },

    updateValues: function()
    {
      if (!this.$els || !this.$els.inputs)
      {
        return;
      }

      ['serviceTag', 'driver', 'gprs', 'led'].forEach(function(property)
      {
        var value = this.model.get(property);

        if (typeof value !== 'string')
        {
          value = '';
        }

        this.updateInputLength(this.$els[property].val(value));
      }, this);
    },

    onModeClick: function()
    {
      this.toggleMode();
      this.toggleControls();
    },

    onModeFocus: function()
    {
      this.$els.mode.blur();
    },

    onModelChange: function()
    {
      this.toggleControls();
    },

    onInputValueChange: function(inputProperty)
    {
      this.$id(inputProperty).find('.form-control').val(this.model.get(inputProperty));
    },

    onInputStatusChange: function(inputProperty)
    {
      this.toggleInputStatus(inputProperty);
    },

    onProgressChange: function()
    {
      if (this.$els)
      {
        this.$els.progress.find('.progress-bar').css('width', this.model.get('progress') + '%');
      }
    },

    onFormSubmit: function(e)
    {
      e.preventDefault();

      if (!this.inputFocused)
      {
        if (this.model.isProgramming())
        {
          this.cancel();
        }
        else
        {
          this.program();
        }
      }
    },

    onKeyDown: function(e)
    {
      if (e.keyCode === 13)
      {
        if (this.commandBuffer.length)
        {
          this.handleCommandBuffer(e);
        }
        else
        {
          var $inputGroup = this.$(e.target).closest('.dashboard-inputGroup');

          if ($inputGroup.length)
          {
            this.inputValue($inputGroup.attr('data-input'));
          }
        }
      }

      this.scheduleClearCommandBuffer();
    },

    onKeyPress: function(e)
    {
      if (e.charCode === 45 || (e.charCode >= 48 && e.charCode <= 57) || (e.charCode >= 65 && e.charCode <= 90))
      {
        this.commandBuffer += String.fromCharCode(e.charCode);
      }

      this.scheduleClearCommandBuffer();
    },

    scheduleClearCommandBuffer: function()
    {
      if (this.timers.clearCommandBuffer)
      {
        clearTimeout(this.timers.clearCommandBuffer);
      }

      this.timers.clearCommandBuffer = setTimeout(this.clearCommandBuffer, 100);
    },

    clearCommandBuffer: function()
    {
      this.commandBuffer = '';

      clearTimeout(this.timers.clearCommandBuffer);
      this.timers.clearCommandBuffer = null;
    },

    handleCommandBuffer: function(e)
    {
      if (!this.$(e.target).length)
      {
        e.preventDefault();
      }

      if (/^P000[0-9]{12}$/.test(this.commandBuffer))
      {
        e.preventDefault();

        this.handleServiceTagCommand();
      }
      else if (/^[0-9A-Z]{6,25}$/.test(this.commandBuffer))
      {
        e.preventDefault();

        this.handleNc12Command(e);
      }
    },

    handleServiceTagCommand: function()
    {
      if (this.model.isProgramming() || this.model.isInputDataLoading('serviceTag'))
      {
        return;
      }

      this.$els.serviceTag.val(this.commandBuffer);
      this.inputValue('serviceTag');
    },

    handleNc12Command: function(e)
    {
      if (this.model.isProgramming())
      {
        return;
      }

      var $target = this.$(e.target);
      var $input = null;
      var nc12 = this.commandBuffer;

      if (nc12.length > 12)
      {
        $input = this.$els.led;
      }
      else if ($target.hasClass('form-control'))
      {
        $input = $target;
      }
      else if (this.$els.driver.val().trim() === '')
      {
        $input = this.$els.driver;
      }
      else if (this.$els.gprs.val().trim() === '')
      {
        $input = this.$els.gprs;
      }
      else if (this.$els.led.val().trim() === '')
      {
        $input = this.$els.led;
      }

      if ($input !== null && !this.model.isInputDataLoading($input.attr('name')))
      {
        this.updateInputLength($input.val(nc12));
        this.inputValue($input.attr('name'));
      }
    },

    cancel: function()
    {
      if (this.$els.cancel.prop('disabled'))
      {
        return;
      }

      var $cancel = this.$els.cancel.prop('disabled', true);
      var view = this;

      this.socket.emit('programmer.cancel', function(err)
      {
        if (!view.$els)
        {
          return;
        }

        if (err)
        {
          $cancel.prop('disabled', false);
          view.showMessage(false, 'cancel:failure');
        }
      });
    },

    program: function()
    {
      if (this.$els.program.prop('disabled') && this.mode !== 'auto')
      {
        return;
      }

      this.$els.inputs.attr('disabled', true);
      this.$els.program.attr('disabled', true);

      var view = this;

      this.socket.emit('programmer.program', function(err)
      {
        if (!view.$els)
        {
          return;
        }

        if (err)
        {
          view.toggleControls();
          view.showMessage(false, 'program:failure');
        }
      });
    },

    showMessage: function(success, text)
    {
      if (this.$msg)
      {
        viewport.msg.hide(this.$msg, true);
      }

      this.$msg = viewport.msg.show({
        type: success ? 'success' : 'error',
        time: success ? SUCCESS_MSG_TIME : FAILURE_MSG_TIME,
        text: t('dashboard', 'msg:' + text)
      });
    }

  });
});
