// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const Generator = require('yeoman-generator');
const path = require('path');
const utils = require('./utils');
const chalk = require('chalk');

/**
 * Base Generator for LoopBack 4
 */
module.exports = class BaseGenerator extends Generator {
  // Note: arguments and options should be defined in the constructor.
  constructor(args, opts) {
    super(args, opts);
    this._setupGenerator();
  }

  /**
   * Subclasses can extend _setupGenerator() to set up the generator
   */
  _setupGenerator() {
    // No operation
  }

  /**
   * Override the usage text by replacing `yo loopback4:` with `lb4 `.
   */
  usage() {
    const text = super.usage();
    return text.replace(/^yo loopback4:/g, 'lb4 ');
  }

  /**
   * Tell this generator to exit with the given reason
   * @param {string|Error} reason
   */
  exit(reason) {
    // exit(false) should not exit
    if (reason === false) return;
    // exit(), exit(undefined), exit('') should exit
    if (!reason) reason = true;
    this.exitGeneration = reason;
  }

  /**
   * Check if the generator should exit
   */
  shouldExit() {
    return !!this.exitGeneration;
  }

  /**
   * Print out the exit reason if this generator is told to exit before it ends
   */
  end() {
    if (this.shouldExit()) {
      this.log(chalk.red('Generation is aborted:', this.exitGeneration));
      return false;
    }
    return true;
  }
};
