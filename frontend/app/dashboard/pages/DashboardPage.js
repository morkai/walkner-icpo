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
  'app/data/currentState',
  'app/data/settings',
  '../views/InputView',
  '../views/ResultView',
  'app/dashboard/templates/page'
], function(
  _,
  $,
  t,
  user,
  viewport,
  View,
  currentState,
  settings,
  InputView,
  ResultView,
  pageTemplate
) {
  'use strict';

  return View.extend({

    layoutName: 'page',

    pageId: 'dashboard',

    template: pageTemplate,

    events: {
      'focus .form-control, .btn, a': 'scheduleBlur',
      'keydown': 'scheduleBlur'
    },

    initialize: function()
    {
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onWindowResize = _.debounce(this.resize.bind(this), 16);
      this.toggleFocusInfo = _.debounce(this.toggleFocusInfo.bind(this), 1);
      this.blur = this.blur.bind(this);
      this.$els = {
        navbar: null,
        focus: null,
        license: null,
        body: $(window.document.body),
        window: $(window)
      };

      this.defineViews();

      this.insertView(this.inputView);

      this.$els.body.on('keydown', this.onKeyDown);
      this.$els.window.on('resize', this.onWindowResize);

      if (user.isLocal())
      {
        this.$els.window
          .on('focus', this.toggleFocusInfo)
          .on('blur', this.toggleFocusInfo);
      }

      this.listenTo(settings, 'change:licenseInfo', this.toggleLicenseInfo);
      this.listenTo(currentState, 'change:result', this.toggleResultDialog);
    },

    destroy: function()
    {
      this.$els.body.off('keydown', this.onKeyDown);
      this.$els.window.off('resize', this.onWindowResize);

      if (user.isLocal())
      {
        this.$els.window
          .off('focus', this.toggleFocusInfo)
          .off('blur', this.toggleFocusInfo);
      }

      this.$els = null;
    },

    defineViews: function()
    {
      this.resultView = null;
      this.inputView = new InputView({model: currentState});
    },

    beforeRender: function()
    {
      clearInterval(this.timers.license);
    },

    afterRender: function()
    {
      this.$els.navbar = $('.navbar-fixed-top');
      this.$els.license = this.$('.dashboard-license');

      if (user.isLocal())
      {
        this.$els.focus = $('<span class="btn active dashboard-focus"></span>').appendTo(this.el);
        this.toggleFocusInfo();
      }

      this.toggleLicenseInfo();
      this.toggleResultDialog();
      this.animateLicenseInfo();

      this.timers.license = setInterval(this.animateLicenseInfo.bind(this), 10000);
      this.timers.resize = setTimeout(this.resize.bind(this), 1);
    },

    scheduleBlur: function()
    {
      if (this.timers.blur)
      {
        clearTimeout(this.timers.blur);
      }

      this.timers.blur = setTimeout(this.blur, 5000);
    },

    resize: function()
    {

    },

    blur: function()
    {
      this.$('a').focus().blur();

      clearTimeout(this.timers.blur);
      this.timers.blur = null;
    },

    toggleFocusInfo: function()
    {
      if (!this.$els)
      {
        return;
      }

      this.$els.focus
        .removeClass('btn-info btn-danger')
        .addClass(document.hasFocus() ? 'btn-info' : 'btn-danger')
        .text(t('dashboard', 'focus:' + document.hasFocus()));
    },

    toggleLicenseInfo: function()
    {
      var licenseInfo = settings.get('licenseInfo');

      this.$els.license.toggle(!licenseInfo || !!licenseInfo.error);
    },

    animateLicenseInfo: function()
    {
      var $license = this.$els.license.removeClass('dashboard-license-animate');

      if ($license.is(':visible'))
      {
        this.timers.licenseAdd = setTimeout(function() { $license.addClass('dashboard-license-animate'); }, 1000);
      }
    },

    toggleResultDialog: function()
    {
      if (currentState.get('result'))
      {
        var page = this;

        this.resultView = new ResultView({
          dialogClassName: 'dashboard-result is-' + currentState.get('result'),
          model: currentState
        });

        this.broker.subscribe('viewport.dialog.shown').setLimit(1).on('message', function()
        {
          page.resultView.$el.parent().prop('scrollTop', 1337);
        });

        this.broker.subscribe('viewport.dialog.hidden').setLimit(1).on('message', function()
        {
          if (user.isLocal())
          {
            page.socket.emit('programmer.reset');
          }

          page.resultView = null;
        });

        viewport.showDialog(this.resultView, t('dashboard', 'result:title'));
      }
      else if (this.resultView)
      {
        viewport.closeDialog();
      }
    },

    onKeyDown: function()
    {
      if (this.resultView !== null)
      {
        viewport.closeDialog();
      }
    }

  });
});
