'use strict'

module.exports = JekyllCommandHelper

function JekyllCommandHelper(config, commandRunner) {
  this.commandRunner = commandRunner
  this.args = ['build', '--trace', '--destination']
}

JekyllCommandHelper.prototype.build = function(buildConfigurations, opts) {
  var helper = this,
      generateBuilds

  generateBuilds = function(previousBuild, config) {
    return previousBuild.then(function() {
      return runBuild(helper, config.destination, opts, config.configurations)
    })
  }
  return buildConfigurations.reduce(generateBuilds, Promise.resolve())
}

function runBuild(helper, destination, opts, configs) {
  var command = 'jekyll',
      args

  args = helper.args.concat(destination).concat('--config').concat(configs)

  if (opts.bundler) {
    command = 'bundle'
    args = ['exec', 'jekyll'].concat(args)
  }
  return helper.commandRunner.run(command, args)
}
