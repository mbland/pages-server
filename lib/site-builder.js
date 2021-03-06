'use strict'

var BuildLogger = require('./build-logger')
var Options = require('./options')
var ComponentFactory = require('./component-factory')
var s3 = require('s3')
var fs = require('fs')
var path = require('path')
var log = require('winston')

module.exports = SiteBuilder

var config = null

SiteBuilder.setConfiguration = function(configuration) {
  config = configuration
}

// Executes the algorithm for cloning/syncing repos and publishing sites.
// Patterned after the ControlFlow pattern used within Google.
//
// Once instantiated, users need only call build(), which is the entry point
// to the algorithm. All other methods are "states" of the algorithm/state
// machine that are executed asynchronously via callbacks.
//
// branch: Branch to build
// components: object containing all the components needed by the SiteBuilder
function SiteBuilder(branch, components) {
  var builder = this

  this.branch = branch
  Object.keys(components).forEach(function(key) {
    builder[key] = components[key]
  })
}

SiteBuilder.prototype.build = function() {
  var builder = this,
      doBuild

  doBuild = function() {
    return builder.gitRunner.prepareRepo(builder.branch)
      .then(function() {
        return builder.configHandler.init()
      })
      .then(function() {
        if (builder.configHandler.usesBundler) {
          return builder.commandRunner.run('bundle', ['install',
            '--path=' + path.join(config.home, config.bundlerCacheDir)])
        }
      })
      .then(function() {
        return builder.configHandler.usesJekyll ?
          buildJekyll(builder) : rsync(builder)
      })
      .then(function() {
        return syncResults(builder)
      })
      .catch(function(err) {
        // We have to handle the error here and pass it through as a resolved
        // Promise, lest we get UnhandledPromiseRejectionWarnings and
        // PromiseRejectionHandledWarnings.
        return err
      })
  }

  return builder.updateLock.doLockedOperation(doBuild).then(function(result) {
    return result instanceof Error ?
      Promise.reject(result) : Promise.resolve(result)
  })
}

function rsync(builder) {
  return builder.configHandler.buildConfigurations().reduce(
    function(previousRsync, buildConfig) {
      return generateRsyncOp(builder, previousRsync, buildConfig)
    },
    Promise.resolve())
}

function generateRsyncOp(builder, previousRsync, buildConfig) {
  return previousRsync.then(function() {
    return builder.commandRunner.run('rsync',
      config.rsyncOpts.concat(['./', buildConfig.destination]))
  })
}

function buildJekyll(builder) {
  var cleanup = function(err) {
    return builder.configHandler.removeGeneratedConfig(err)
  }

  return builder.configHandler.readOrWriteConfig()
    .then(function() {
      return builder.jekyllHelper.build(
        builder.configHandler.buildConfigurations(),
        { bundler: builder.configHandler.usesBundler })
    })
    .then(cleanup, cleanup)
}

function syncResults(builder) {
  return builder.configHandler.buildConfigurations().reduce(
    function(previousSync, buildConfig) {
      return generateSyncOp(builder, previousSync, buildConfig)
    },
    Promise.resolve())
}

function generateSyncOp(builder, previousSync, buildConfig) {
  return previousSync.then(function() {
    return builder.sync.sync(buildConfig.destination)
  })
}

SiteBuilder.launchBuilder = function(hook, branch, builderConfig) {
  var builderOpts = new Options(hook, config, builderConfig),
      buildLog = builderOpts.sitePath + '.log',
      logger = new BuildLogger(buildLog),
      builder = new SiteBuilder(branch,
        new ComponentFactory(config, builderOpts, branch, s3client(), logger)),
      finishBuild,
      migrateLog

  logger.log(hook.collection + '/' + hook.repository + ':',
    'starting build at commit', hook.commit.id)
  logger.log('description:', hook.commit.message)
  logger.log('timestamp:', hook.commit.timestamp)
  logger.log('author:', hook.author.name, hook.author.email)

  if (hook.committer) {
    logger.log('committer:', hook.committer.name, hook.committer.email)
  }
  if (hook.pusher) {
    logger.log('pusher:', hook.pusher.name, hook.pusher.email)
  }

  finishBuild = function(err) {
    return new Promise(function(resolve, reject) {
      // Provides https://PAGES-HOST/REPO-NAME/build.log as an indicator of
      // latest status.
      if (err) {
        logger.error(err.message ? err.message : err)
        logger.error(builderOpts.repoName + ': build failed')
      } else {
        logger.log(builderOpts.repoName + ': build successful')
      }
      logger.close(function() {
        return err ? reject(err) : resolve()
      })
    })
  }

  migrateLog = function(err) {
    var newLogPath = path.join(
      builder.configHandler.buildDestination, 'build.log')

    return copyLog(buildLog, newLogPath)
      .then(function() {
        return removeLog(buildLog)
      })
      .catch(function(err) {
        log.error('Error moving build log: ' + (err.message || err))
        return Promise.reject(err)
      })
      .then(function() {
        return err ? Promise.reject(err) : Promise.resolve()
      })
  }
  return builder.build()
    .then(finishBuild, finishBuild)
    .then(migrateLog, migrateLog)
}

function s3client() {
  return new s3.createClient({
    s3Options: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })
}

// When the git repositories live on one Docker volume (pages/repos), and the
// generated sites live on another (pages/sites), fs.rename(), fails with:
//
//   Error moving build log: Error: EXDEV: cross-device link not permitted,
//   rename '/usr/local/foo/pages/repos/pages-internal.foo.com/site.log' ->
//   '/usr/local/foo/pages/sites/pages-internal.foo.com/hub/build.log'
//
// Copying and manually removing the original log resolves this issue.
function copyLog(sourceLog, targetLog) {
  return new Promise(function(resolve, reject) {
    var sourceStream = fs.createReadStream(sourceLog),
        targetStream = fs.createWriteStream(targetLog)

    sourceStream.on('error', reject)
    targetStream.on('error', reject)
    targetStream.on('close', resolve)
    sourceStream.pipe(targetStream)
  })
}

function removeLog(sourceLog) {
  return new Promise(function(resolve, reject) {
    fs.unlink(sourceLog, function(err) {
      return err ? reject(err) : resolve()
    })
  })
}
