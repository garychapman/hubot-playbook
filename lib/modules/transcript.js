'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);
var _base = require('./base');var _base2 = _interopRequireDefault(_base);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

_lodash2.default.mixin({
  'hasKeys': (obj, keys) => _lodash2.default.size(_lodash2.default.difference(keys, _lodash2.default.keys(obj))) === 0 });

_lodash2.default.mixin({
  'pickHas': (obj, pickKeys) => _lodash2.default.omitBy(_lodash2.default.pick(obj, pickKeys), _lodash2.default.isUndefined) });


/**
                                                                                                                                 * Records conversation events, including meta about the user, message and
                                                                                                                                 * current module state. Instances are configurable to provide an overview or
                                                                                                                                 * drilled down analytics of specific interactions.
                                                                                                                                 *
                                                                                                                                 * Transcripts are searchable, to provide context for interactions from
                                                                                                                                 * conversation history with a given user of any other attribute. If saving to
                                                                                                                                 * the hubot brain, they will also search from the brain's persisted transcript
                                                                                                                                 * history.
                                                                                                                                 *
                                                                                                                                 * It can record attributes from any event emitted through the robot or just
                                                                                                                                 * those originating from a given Playbook module instance.
                                                                                                                                 *
                                                                                                                                 * @param {Robot}  robot                  Hubot Robot instance
                                                                                                                                 * @param {Object} [options]              Key/val options for config
                                                                                                                                 * @param {Object} [options.save]         Store records in hubot brain
                                                                                                                                 * @param {array} [options.events]        Event names to record
                                                                                                                                 * @param {array} [options.responseAtts]  Response keys or paths to record
                                                                                                                                 * @param {array} [options.instanceAtts]  Module instance keys or paths to record
                                                                                                                                 * @param {string} [key]                  Key name for this instance
                                                                                                                                 *
                                                                                                                                 * @todo Add config to record response middleware context including listener ID
                                                                                                                                 *
                                                                                                                                 * @example <caption>transcript to record room name when match emitted</caption>
                                                                                                                                 * let matchRecordRooms = new Transcript(robot, {
                                                                                                                                 *   responseAtts: ['message.room']
                                                                                                                                 *   events: ['match']
                                                                                                                                 * })
                                                                                                                                 * // does not start recording until calling one of the record methods, like:
                                                                                                                                 * matchRecordRooms.recordAll()
                                                                                                                                */
class Transcript extends _base2.default {
  constructor(...args) {
    super('transcript', ...args);
    this.defaults({
      save: true,
      events: ['match', 'mismatch', 'catch', 'send'],
      instanceAtts: ['name', 'key', 'id'],
      responseAtts: ['match'],
      messageAtts: ['user.id', 'user.name', 'room', 'text'] });

    if (this.config.instanceAtts != null) _lodash2.default.castArray(this.config.instanceAtts);
    if (this.config.responseAtts != null) _lodash2.default.castArray(this.config.responseAtts);
    if (this.config.messageAtts != null) _lodash2.default.castArray(this.config.messageAtts);

    if (this.config.save) {
      if (!this.robot.brain.get('transcripts')) {
        this.robot.brain.set('transcripts', []);
      }
      this.records = this.robot.brain.get('transcripts');
    }
    if (this.records == null) this.records = [];
  }

  /**
     * Record given event details in array, save to hubot brain if configured to.
     *
     * Events emitted by Playbook always include module instance as first param.
     *
     * This is only called internally on watched events after running `recordAll`,
     * `recordDialogue`, `recordScene` or `recordDirector`
     *
     * @param  {string} event   The event name
     * @param  {Mixed} args...  Args passed with the event, usually consists of:<br>
     *                          - Playbook module instance<br>
     *                          - Hubot response object<br>
     *                          - other additional (special context) arguments
    */
  recordEvent(event, ...args) {
    let instance, response;
    if (_lodash2.default.hasKeys(args[0], ['name', 'id', 'config'])) instance = args.shift();
    if (_lodash2.default.hasKeys(args[0], ['robot', 'message'])) response = args.shift();
    const record = { time: _lodash2.default.now(), event };
    if (this.key != null) record.key = this.key;
    if (instance != null && this.config.instanceAtts != null) {
      record.instance = _lodash2.default.pickHas(instance, this.config.instanceAtts);
    }
    if (response != null && this.config.responseAtts != null) {
      record.response = _lodash2.default.pickHas(response, this.config.responseAtts);
    }
    if (response != null && this.config.messageAtts != null) {
      record.message = _lodash2.default.pickHas(response.message, this.config.messageAtts);
    }

    // TODO
    // Strings are sent as additional args for sends, because dialogues can't get
    // access to the generated response object without adding middleware, they
    // only have the user's response being replied to, otherwise the robot's text
    // is lost.
    // Once middleware returns a promise, it should resolve with the new
    // response object sent by the robot, then send should be emitted with that
    // so keeping the strings as an additional property won't be required and the
    // records will be more consistently structured for querying an interaction
    if (!_lodash2.default.isEmpty(args)) {
      if (event === 'send') record.strings = args;else
      record.other = args;
    }

    this.records.push(record);
    this.emit('record', record);
  }

  /**
     * Record events emitted by all Playbook modules and/or the robot itself
     * (still only applies to configured event types).
    */
  recordAll() {
    _lodash2.default.castArray(this.config.events).map(event =>
    this.robot.on(event, (...args) =>
    this.recordEvent(event, ...args)));

  }

  /**
     * @todo Re-instate `recordListener` when regular listeners emit event with
     * context containing options and ID.
     */
  /*
        recordListener (context) {
         }
        */


  /**
            * Record events emitted by a given dialogue.
            *
            * @param {Dialogue} dialogue The Dialogue instance
           */
  recordDialogue(dialogue) {
    _lodash2.default.castArray(this.config.events).map(event => {
      dialogue.on(event, (...args) => {
        this.recordEvent(event, ...args);
      });
    });
  }

  /**
     * Record events emitted by a given scene and any dialogue it enters, captures
     * all events fromn the scene but only configured events from dialogue.
     *
     * @param {Scene} scene The Scnee instance
    */
  recordScene(scene) {
    scene.on('enter', (scene, res, dialogue) => {
      this.recordEvent('enter', scene, res);
      this.recordDialogue(dialogue);
    });
    scene.on('exit', (...args) => this.recordEvent('exit', ...args));
  }

  /**
     * Record allow/deny events emitted by a given director. Ignores configured
     * events because director has distinct events.
     *
     * @param {Director} director The Director instance
    */
  recordDirector(director) {
    director.on('allow', (...args) => this.recordEvent('allow', ...args));
    director.on('deny', (...args) => this.recordEvent('deny', ...args));
  }

  /**
     * Filter records matching a subset, e.g. user name or instance key.
     *
     * Optionally return the whole record or values for a given key.
     *
     * @param  {Object} subsetMatch  Key/s:value/s to match (accepts path key)
     * @param  {string} [returnPath] Key or path within record to return
     * @return {array}               Whole records or selected values found
     *
     * @example
     * transcript.findRecords({
     *   message: { user: { name: 'jon' } }
     * })
     * // returns array of recorded event objects
     *
     * transcript.findRecords({
     *   message: { user: { name: 'jon' } }
     * }, 'message.text')
     * // returns array of message text attribute from recroded events
    */
  findRecords(subsetMatch, returnPath) {
    let found = _lodash2.default.filter(this.records, subsetMatch);
    if (returnPath == null) return found;
    let foundAtPath = found.map(record => (0, _lodash2.default)(record).at(returnPath).head());
    _lodash2.default.remove(foundAtPath, _lodash2.default.isUndefined);
    return foundAtPath;
  }

  /**
     * Alias for findRecords for just response match attributes with a given
     * instance key, useful for simple lookups of information provided by users
     * within a specific conversation.
     *
     * @param  {string}  instanceKey    Recorded instance key to lookup
     * @param  {string}  [userId]       Filter results by a user ID
     * @param  {integer} [captureGroup] Filter match by regex capture group subset
     * @return {array}                  Contains full match or just capture group
     *
     * @example <caption>find answers from a specific dialogue path</caption>
     * const transcript = new Transcript(robot)
     * robot.hear(/color/, (res) => {
     *   let favColor = new Dialogue(res, 'fav-color')
     *   transcript.recordDialogue(favColor)
     *   favColor.addPath([
     *     [ /my favorite color is (.*)/, 'duly noted' ]
     *   ])
     *   favColor.receive(res)
     * })
     * robot.respond(/what is my favorite color/, (res) => {
     *   let colorMatches = transcript.findKeyMatches('fav-color', 1)
     *   # ^ word we're looking for from capture group is at index: 1
     *   if (colorMatches.length) {
     *     res.reply(`I remember, it's ${ colorMatches.pop() }`)
     *   } else {
     *     res.reply("I don't know!?")
     *   }
     * })
     *
    */
  findKeyMatches(instanceKey, ...args) {
    let userId = _lodash2.default.isString(args[0]) ? args.shift() : null;
    let captureGroup = _lodash2.default.isInteger(args[0]) ? args.shift() : null;
    let subset = { instance: { key: instanceKey } };
    let path = 'response.match';
    if (userId != null) _lodash2.default.extend(subset, { message: { user: { id: userId } } });
    if (captureGroup != null) path += `[${captureGroup}]`;
    return this.findRecords(subset, path);
  }

  /**
     * Alias for findRecords for just response match attributes with a given
     * listener ID, useful for lookups of matches from a specific listener.
     *
     * @param  {string}  listenerId     Listener ID match to lookup
     * @param  {string}  [userId]       Filter results by a user ID
     * @param  {integer} [captureGroup] Filter match by regex capture group subset
     * @return {array}                  Contains full match or just capture group
     *
     * @todo Re-instate `findIdMatches` when `recordListener` is funtional
    */
  /*
       findIdMatches (listenerId, ...args) {
         let userId = (_.isString(args[0])) ? args.shift() : null
         let captureGroup = (_.isInteger(args[0])) ? args.shift() : null
         let subset = { listener: { options: { id: listenerId } } }
         let path = 'response.match'
         if (userId != null) subset.message = { user: { id: userId } }
         if (captureGroup != null) path += `[${captureGroup}]`
         return this.findRecords(subset, path)
       }
       */}exports.default =


Transcript;module.exports = exports['default'];