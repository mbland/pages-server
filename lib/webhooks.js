'use strict'

var SiteBuilder = require('./site-builder')
var log = require('winston')

exports = module.exports = {}

// Parses the collection to which a repository belongs from gitUrlPrefix.
//
// This is usually a username, organization, or project.
exports.collectionFromGitUrlPrefix = function(gitUrlPrefix) {
  return gitUrlPrefix.replace(/\/$/, '').split(/[:/]/).pop().toLowerCase()
}

// Returns the specified webhook parser.
//
// `webhookType` must match one of the module names in `lib/webhooks`; not case
// sensitive.
exports.getParser = function(webhookType) {
  try {
    return require('./webhooks/' + (webhookType || 'github').toLowerCase())
  } catch (_) {
    throw new Error('Unknown webhookType: ' + webhookType)
  }
}

// Returns a function that builds webhooks matching the configuration
//
// Values in `builderConfig` will override default values in `config`.
exports.createBuilder = function(config, builderConfig) {
  var collection = exports.collectionFromGitUrlPrefix(
        builderConfig.gitUrlPrefix || config.gitUrlPrefix),
      branchPattern = builderConfig.branchInUrlPattern || builderConfig.branch,
      branchRegexp = new RegExp('refs/heads/(' + branchPattern + ')$')

  return function(parsedHook) {
    var branch = branchRegexp.exec(parsedHook.branch)

    if (branch && parsedHook.collection === collection) {
      return SiteBuilder.launchBuilder(parsedHook, branch[1], builderConfig)
    } else {
      return Promise.resolve()
    }
  }
}

// Runs all builders matching a valid webhook
//
// If the webhook is valid, send will receive a 202 (Accepted) status, and the
// function will return a Promise that resolves when all matching builders are
// finished.
//
// Otherwise `send` will receive a 400 (Bad Request) status, and the function
// returns an empty resolved Promise.
exports.handleWebhook = function(hook, parser, builders, send) {
  var parsed = null

  try {
    log.debug('INCOMING:', JSON.stringify(hook, null, 2))
    parsed = parser(hook)
  } catch (err) {
    log.debug('PARSE ERROR:', err.toString())
  }

  if (parsed === null) {
    send(400)
    return Promise.resolve()
  }
  send(202)
  log.debug('PARSED:', JSON.stringify(parsed, null, 2))
  return Promise.all(builders.map(builder => builder(parsed)))
}

// Returns a (hook, send) that will respond to hooks matching the configuration
//
// Instantiates a webhook parser and generates a list of builders based on
// `config` for the returned closure.
//
// The `send` argument and returned Promises are identical to those from
// `handleWebhook`.
exports.createHandler = function(config) {
  var parser = exports.getParser(config.webhookType),
      builders = config.builders.map(builder => {
        return exports.createBuilder(config, builder)
      })
  return (hook, send) => exports.handleWebhook(hook, parser, builders, send)
}
