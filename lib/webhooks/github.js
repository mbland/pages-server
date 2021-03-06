'use strict'

// Parses GitHub webhooks and parses them into a common format
// https://developer.github.com/v3/activity/events/types/#pushevent
module.exports = function(hook) {
  var branch = hook.ref,
      repository = hook.repository,
      commit = hook.head_commit,
      pusher = hook.pusher

  if ([branch, repository, commit, pusher].indexOf(undefined) !== -1) {
    return null
  }

  return {
    branch: branch,
    collection: repository.organization,
    repository: repository.name,
    commit: {
      id: commit.id,
      message: commit.message,
      timestamp: commit.timestamp
    },
    author: {
      name: commit.author.name,
      email: commit.author.email
    },
    committer: {
      name: commit.committer.name,
      email: commit.committer.email
    },
    pusher: {
      name: hook.pusher.name,
      email: hook.pusher.email
    }
  }
}
