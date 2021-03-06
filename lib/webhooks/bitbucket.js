'use strict'

// Parses POST service webhooks for Bitbucket Server
// https://confluence.atlassian.com/bitbucketserver/
//   post-service-webhook-for-bitbucket-server-776640367.html
module.exports = function(hook) {
  var refChanges = hook.refChanges,
      repository = hook.repository,
      changesets = hook.changesets,
      commit,
      timestamp

  if ([refChanges, repository, changesets].indexOf(undefined) !== -1 ||
      !changesets.isLastPage) {
    return null
  }
  commit = changesets.values[0].toCommit
  timestamp = new Date(commit.authorTimestamp)

  return {
    branch: refChanges[0].refId,
    collection: repository.project.key.toLowerCase(),
    repository: repository.slug,
    commit: {
      id: commit.id,
      message: commit.message,
      timestamp: timestamp.toLocaleString()
    },
    author: {
      name: commit.author.name,
      email: commit.author.emailAddress
    }
  }
}
