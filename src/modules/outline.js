import fs from 'fs'
import _ from 'lodash'
import yaml from 'yamljs'
import Base from './base'

/**
 * Processes a conversation modelling schema, with attributes for conversation
 * nodes (including scenes, dialogues, paths and directors) defined as _bits_.
 *
 * Outlines can be loaded from YAML files or passed directly as an array of
 * objects, to initialise the listeners and callbacks to execute each bit.
 *
 * Bits can lead to consequitive bits, with branches to follow as responses
 * are matched against the bit's `condition`. Those with a `listen` attribute
 * are effectively _global_ entry points to a scene, where others are only
 * accessesable in the scope of a parent scene.
 *
 * A subsequent bit can even lead back to it's own parent or any other bit
 * (_global_ or not) but the scene scope can't change once entered.
 *
 * @param {string/Object[]} bits      Attributes to setup bits (accepts YAML file path)
 * @param {array}  bits[].send        String/s to send when doing bit (minimum requirement)
 * @param {string} [bits[].catch]     To send if response unmatched by listeners
 * @param {string} [bits[].condition] Converted to regex for listener to trigger bit
 * @param {string} [bits[].listen]    Type of listener (hear|respond) for scene entry bit
 * @param {string} [bits[].scene]     Scope for the scene (only used if it has a listen type)
 * @param {string} [bits[].key]       Key for scene and/or dialogue running the bit
 * @param {Object} [bits[].options]   Key/val options for scene and/or dialogue config
 * @param {array} [bits[].next]       Key/s (strings) for consequitive bits
 * @param {Object} [options]          Key/val options for outline config
 * @param {string} [key]              Key name for this instance
 *
 * @todo Add bit attribute for callback function as a key of extended response
 * @todo Add bit attribute for director whitelist/blacklist names and/or auth function
 */
class Outline extends Base {
  constructor (robot, bits, ...args) {
    super('outline', robot, ...args)
    this.scenes = []
    this.bits = (_.isString(bits) && fs.existsSync(bits)) ? yaml.load(bits) : bits
    _.filter(this.bits, 'listen').map((bit) => this.setupScene(bit))
  }

  /**
   * Send messages and setup any following listeners for a bit.
   *
   * Called in an open dialogue, as a callback on entering the scene or
   * continuing from a prior bit. Adds the bit as a property of the response.
   *
   * @param  {Response} res Hubot Response object
   * @param  {string} key   The key for a loaded bit
   */
  doBit (res, key) {
    res.bit = this.bits[key]
    this.setupDialogue(res).send(...res.bit.send)
    if (res.bit.next) this.setupPath(res)
  }

  /**
   * Prepare the arguments required to add listener for a scene entering bit.
   *
   * Only applicable to bits with a `listen` attribute (hear or respond).
   * Subsequent bits will play out within the same scene so their listen type is
   * irrelevant because all responses from an engaged audience will be routed
   * through the current dialogue.
   *
   * Bits only require a `.listen` and `.condition` property to setup a scene
   * listener and will use defaults if `.scope` and `.options` are null.
   *
   * @param  {Object} bit Attributes to setup scene for entry to bit
   */
  setupScene (bit) {
    if (bit.listen !== null) {
      this.scenes.push({
        listen: bit.listen,
        regex: this.bitCondition(bit.key),
        type: bit.scope,
        options: bit.options,
        key: bit.key,
        callback: (res) => this.doBit(res, bit.key)
      })
    }
  }

  /**
   * Get arguments to pass into scene listeners for _global_ bits.
   *
   * @return {array} Items contain required arguments (call with spread syntax)
   *
   * @example <caption>The hard way</caption>
   * const scene = new Scene(robot)
   * const outline = new Outline('./conversation.yml')
   * outline.getSceneArgs().map((args) => scene.listen(...args)
   *
   * @example <caption>The easy way</caption>
   * const pb = new Playbook(robot).outline('./conversation.yml')
   * // ^ playbook helper creates outline and sets up scenes
   */
  getSceneArgs () {
    return this.scenes.map((scene) => [
      scene.listen, scene.regex, scene.type, scene.options, scene.callback
    ])
  }

  /**
   * Dialogue is already open from the scene being triggered.
   *
   * @param  {Response} res Hubot Response object
   */
  setupDialogue (res) {
    let options = {}
    let bit = res.bit
    let dialogue = res.dialogue
    if (bit.reply !== null) options.sendReplies = bit.reply
    if (bit.timeout !== null) options.timeout = bit.timeout
    if (bit.timeoutText !== null) options.timeoutText = bit.timeout
    dialogue.configure(options)
    dialogue.key = bit.key
    return dialogue
  }

  /**
   * Add path options and branches to
   *
   * @param  {Response} res Hubot Response object
   */
  setupPath (res, dlg) {
    const bit = res.bit
    const options = {}
    if (bit.catch) options.catchMessage = bit.catch
    const branches = bit.next.map((nextKey) => {
      let regex = this.bitCondition(nextKey)
      let callback = (res) => this.doBit(res, nextKey)
      return [regex, callback]
    })
    dlg.addPath(branches, options, bit.key)
  }

  /**
   * Convert a bit's condition attribute into a regex.
   *
   * @param  {string} key The key for a loaded bit
   * @return {RegExp}     The pattern for the bit's listener
   *
   * @todo Use `conditioner-regex` to convert array of conditions to pattern
   */
  bitCondition (key) {
    return new RegExp(`\\b${this.bits[key].condition}\\b`, 'i')
  }
}

export default Outline