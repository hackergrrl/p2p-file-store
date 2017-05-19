module.exports = MediaStore

var Store = require('fs-blob-store')
var path = require('path')
var walk = require('fs-walk')
var fs = require('fs')
var mkdirp = require('mkdirp')
var debug = require('debug')('p2p-file-store')
var pathIsInside = require('path-is-inside')

var missing = require('./missing')
var replication = require('./replication')

function noop () {}

function MediaStore (dir, opts) {
  if (!(this instanceof MediaStore)) return new MediaStore(dir, opts)

  // TODO: expose whether to use a 'staging' subdir

  this._dir = dir
  this._stores = {}
}

MediaStore.prototype._getStore = function (dir) {
  if (!this._stores[dir]) {
    this._stores[dir] = Store(path.join(this._dir, dir))
  }
  return this._stores[dir]
}

MediaStore.prototype._list = function (cb) {
  var names = []
  walk.files(this._dir, (basedir, filename, stat, next) => {
    var name = path.relative(this._dir, path.join(basedir, filename))
    if (!basedir.endsWith('staging')) names.push(name)
    next()
  }, function (err) {
    if (err && err.code === 'ENOENT') cb(null, [])
    else cb(err, names)
  })
}

MediaStore.prototype.createReadStream = function (filepath) {
  filepath = path.resolve(this._dir, filepath)
  if (!pathIsInside(filepath, this._dir)) {
    return done(new Error('cannot write outside of file store root directory'))
  }
  var storepath = path.relative(this._dir, path.dirname(filepath))
  var name = path.basename(filepath)

  var store = this._getStore(storepath)
  return store.createReadStream(name)
}

// TODO: opts to choose whether to use staging area
MediaStore.prototype.createWriteStream = function (filepath, done) {
  var self = this
  done = done || noop

  filepath = path.resolve(this._dir, filepath)
  if (!pathIsInside(filepath, this._dir)) {
    return done(new Error('cannot write outside of file store root directory'))
  }
  var storepath = path.relative(this._dir, path.dirname(filepath))
  var name = path.basename(filepath)

  var stagingStore = this._getStore(path.join('staging', storepath))
  var ws = stagingStore.createWriteStream(name)
  ws.on('finish', onFinish)
  ws.on('error', done || noop)
  return ws

  function onFinish () {
    // write result to destination
    var from = path.join(self._dir, 'staging', storepath, name)
    var to = path.join(self._dir, storepath, name)

    debug('gonna rename', from, to)
    mkdirp(path.join(self._dir, storepath), function (err) {
      if (err) return done(err)
      fs.rename(from, to, function (err) {
        debug('renamed')
        done(err)
      })
    })
  }
}

MediaStore.prototype.replicateStore = function (otherStore, opts, done) {
  if (typeof opts === 'function' && !done) {
    done = opts
    opts = null
  }
  opts = opts || {}

  var pending = 2
  var self = this
  done = done || noop

  var progressFn = opts.progressFn || noop
  var filesLeftToXfer = 0
  var filesToXfer = 0

  this._list(function (err, myNames) {
    if (err) return done(err)
    filesToXfer += myNames.length
    otherStore._list(function (err, yourNames) {
      if (err) return done(err)
      filesToXfer += yourNames.length
      filesLeftToXfer = filesToXfer

      var myWant = missing(myNames, yourNames)
      debug('I want', myWant)
      xferAll(otherStore, self, myWant, function (err) {
        // TODO: catch + return error(s)
        if (--pending === 0) return done(err)
      })

      var yourWant = missing(yourNames, myNames)
      debug('you want', yourWant)
      xferAll(self, otherStore, yourWant, function (err) {
        // TODO: catch + return error(s)
        if (--pending === 0) return done(err)
      })
    })
  })

  function xfer (from, to, name, fin) {
    debug('gonna xfer', name)

    var ws = to.createWriteStream(name, onFinish)
    var rs = from.createReadStream(name)
    rs.pipe(ws)

    debug('xferring', name)

    function onFinish (err) {
      debug('xferred', name, err)
      fin(err)
    }
  }

  function xferAll (from, to, names, fin) {
    if (names.length === 0) {
      debug('done xferring')
      return fin()
    }

    var next = names.pop()
    xfer(from, to, next, function (err) {
      filesLeftToXfer--
      progressFn(1 - filesLeftToXfer / filesToXfer)

      if (err) fin(err)
      else xferAll(from, to, names, fin)
    })
  }
}

MediaStore.prototype.replicateStream = function (opts) {
  return replication(this, opts)
}

// String, Number -> String
function filenamePrefix (name, prefixLen) {
  return name.substring(0, Math.min(prefixLen, name.lastIndexOf('.')))
}
