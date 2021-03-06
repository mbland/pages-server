'use strict'

var path = require('path')

module.exports = Options

// Creates an options object to pass to the SiteBuilder constructor
//
// Arguments:
//   hook: GitHub webhook payload
//   config: full Pages configuration object containing system-wide settings
//   builderConfig: builder configuration for a specific input branch
//
// Returns an object with the following properties:
//   repoDir: path to the cloned repository
//   repoName: name of the repo belonging to the GitHub organization
//   sitePath: path to the repo of the specific Pages site being rebuilt
//   branch: branch of the Pages repository to check out and rebuild
//   destDir: input argument prefixed with config.home
//   internalDestDir: internal documentation destination from builderConfig
//   gitUrlPrefix: from builderConfig or top-level config
//   pagesConfig: from builderConfig or top-level config
//   pagesYaml: from builderConfig or top-level config
function Options(hook, config, builderConfig) {
  var repoDir = builderConfig.repositoryDir
  var destDir = builderConfig.generatedSiteDir

  this.repoDir = path.join(config.home, repoDir)
  this.repoName = hook.repository
  this.sitePath = path.join(config.home, repoDir, hook.repository)
  this.destDir = path.join(config.home, destDir)
  if (builderConfig.internalSiteDir) {
    this.internalDestDir = path.join(
      config.home, builderConfig.internalSiteDir)
  }
  this.gitUrlPrefix = builderConfig.gitUrlPrefix || config.gitUrlPrefix
  this.gitUrlPrefix += this.gitUrlPrefix.endsWith('/') ? '' : '/'
  this.pagesConfig = builderConfig.pagesConfig || config.pagesConfig
  this.pagesYaml = builderConfig.pagesYaml || config.pagesYaml

  if (builderConfig.branchInUrlPattern) {
    this.branchInUrlPattern = new RegExp(builderConfig.branchInUrlPattern, 'i')
  }
}
