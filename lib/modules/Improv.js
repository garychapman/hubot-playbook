// Generated by CoffeeScript 1.12.5
(function() {
  var Base, Handlebars, HandlebarsIntl, Improv, _,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  _ = require('lodash');

  Base = require('./Base');

  Handlebars = require('handlebars');

  HandlebarsIntl = require('handlebars-intl');

  HandlebarsIntl.registerWith(Handlebars);


  /**
   * Merge template tags with contextual content (using handlebars), from app
   * environment, user attributes or manually populated keys.
   * Config:
   * fallback: Fallback content replace any unknowns
   * replacement: Replaces entire messages containing unknowns, overrides fallback
   * locale: Locale for format localisation - yahoo/handlebars-intl
   * formats: Additional named date/time formats
   * @param {Robot}        robot   - Hubot Robot instance
   * @param {Array|String} @admins - Usernames authorised to populate context data
   * @param {Object} [options] - Key/val options for config
   * @param {String} [key]     - Key name for this instance
   */

  Improv = (function(superClass) {
    extend(Improv, superClass);

    function Improv() {
      var admins, args, robot;
      robot = arguments[0], admins = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.admins = admins;
      this.defaults = {
        fallback: process.env.IMRPOV_FALLBACK || 'unknown',
        replace: process.env.IMRPOV_REPLACE || null,
        locale: process.env.IMRPOV_LOCALE || null,
        formats: null,
        appData: null
      };
      Improv.__super__.constructor.apply(this, ['improv', robot].concat(slice.call(args)));
      if (this.config.locale != null) {
        this.intl.locale = this.config.locale;
      }
      if (this.config.formats != null) {
        this.intl.formats = this.config.formats;
      }
      robot.responseMiddleware((function(_this) {
        return function(c, n, d) {
          return _this.middleware.call(_this, c, n, d);
        };
      })(this));
    }


    /**
     * Middleware checks for template tags and parses if required
     * @param  {Object}   context - Passed through the middleware stack, with res
     * @param  {Function} next    - Called when all middleware is complete
     * @param  {Function} done    - Initial (final) completion callback
     */

    Improv.prototype.middleware = function(context, next, done) {
      if (_.anyMatch(context.strings, /{{.*}}/)) {
        context.strings = this.parse(strings, this.mergeData(context.response.message.user));
      }
      return next(done);
    };


    /**
     * Provdies currnet known user and app data for merging with tempalte
     * @param  {[type]} user [description]
     * @return {[type]}      [description]
     */

    Improv.prototype.mergeData = function(user) {
      var data;
      data = {};
      data.app = _.extend(this.config.appData, robot.brain.get('appData'));
      if (user != null) {
        data.user = robot.brain.userForId(user.id);
      }
      return data;
    };


    /**
     * Merge templated messages with data
     * TODO: use fallback/replace for unknowns
     * @param  {Array}  string  - One or more strings being posted
     * @param  {Object} data    - Key/vals for template tags (app and/or user)
     * @return {Array}          - Strings populated with context values
     */

    Improv.prototype.parse = function(strings, data) {
      return _.map(strings(function(string) {
        var template;
        template = Handlebars.compile(string);
        if (this.intl != null) {
          return template(data, {
            data: {
              intl: this.intl
            }
          });
        }
        return template(data);
      }));
    };

    Improv.prototype.prepare = function(strings) {};

    Improv.prototype.warn = function(unknowns) {};

    Improv.prototype.remember = function(key, content) {};

    Improv.prototype.forget = function(key) {};

    return Improv;

  })(Base);

}).call(this);