/* jshint node: true */
/* jshint expr: true */
'use strict';

var fs = require('fs');
var path = require('path');

module.exports = FilesHelper;

function FilesHelper(config, done) {
  this.testRepoDir = path.resolve(__dirname, 'site_builder_test');
  this.gemfile = path.resolve(this.testRepoDir, 'Gemfile');
  this.pagesConfig = path.resolve(this.testRepoDir, config.pagesConfig);
  this.configYml = path.resolve(this.testRepoDir, '_config.yml');
  this.internalConfig = path.resolve(this.testRepoDir, '_config_internal.yml');
  this.externalConfig = path.resolve(this.testRepoDir, '_config_external.yml');
  this.lockDir = path.resolve(__dirname, 'site_builder_test_lock_dir');
  this.lockfilePath = path.resolve(this.lockDir, '.update-lock-repo_name');
  fs.mkdir(this.lockDir, '0700', done);
}

FilesHelper.prototype.afterEach = function(done) {
  var that = this;
  this.removeFile(this.configYml)
    .then(function() { return that.removeFile(that.fileToDelete); })
    .then(function() { return that.removeRepoDir(); })
    .then(done, done);
};

FilesHelper.prototype.after = function(done) { fs.rmdir(this.lockDir, done); };

FilesHelper.prototype.createRepoDir = function(done) {
  var that = this;
  fs.mkdir(this.testRepoDir, '0700', function() {
    fs.writeFile(that.configYml, '', done);
  });
};

FilesHelper.prototype.createRepoWithFile = function(filename, contents, done) {
  this.fileToDelete = filename;
  this.createRepoDir(function() {
    fs.writeFile(filename, contents, done);
  });
};

FilesHelper.prototype.removeFile = function(filename) {
  if (!filename) { return Promise.resolve(); }
  return new Promise(function(resolve, reject) {
    fs.exists(filename, function(exists) {
      if (exists) {
        fs.unlink(filename, function(err) {
          if (err) { reject(err); } else { resolve(); }
        });
      }
      resolve();
    });
  });
};

FilesHelper.prototype.removeRepoDir = function() {
  var that = this;
  return new Promise(function(resolve, reject) {
    fs.exists(that.testRepoDir, function(exists) {
      if (!exists) { return resolve(); }
      fs.rmdir(that.testRepoDir, function(err) {
        if (err) { reject(err); } else { resolve(); }
      });
    });
  });
};
