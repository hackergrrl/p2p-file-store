module.exports = MediaStore

var Store = require('fs-blob-store')
var path = require('path')
var walk = require('fs-walk')

function MediaStore (dir, opts) {
  if (!(this instanceof MediaStore)) return new MediaStore(dir, opts)

  // TODO: expose whether to use subdirs opt
  // TODO: expose subdir prefix length opt

  this._dir = dir
  this._stores = {}
}

MediaStore.prototype._getStore = function (subdir) {
  if (!this._stores[subdir]) {
    this._stores[subdir] = Store(path.join(this._dir, subdir))
  }
  return this._stores[subdir]
}

MediaStore.prototype.createReadStream = function (name) {
  var subdir = nameToSubdir(name, 7)
  var store = this._getStore(subdir)
  return store.createReadStream(name)
}

MediaStore.prototype.createWriteStream = function (name) {
  var subdir = nameToSubdir(name, 7)
  var store = this._getStore(subdir)
  return store.createWriteStream(name)
}

MediaStore.prototype._list = function (cb) {
  var names = []
  walk.files(this._dir, function (basedir, filename, stat, next) {
    names.push(filename)
    next()
  }, function (err) {
    if (err && err.code === 'ENOENT') cb(null, [])
    else cb(err, names)
  })
}

MediaStore.prototype.replicateStore = function (otherStore, done) {
  var pending = 2
  var self = this

  this._list(function (err, myNames) {
    if (err) return done(err)
    otherStore._list(function (err, yourNames) {
      if (err) return done(err)

      var myWant = missing(myNames, yourNames)
      console.log('I want', myWant)
      xferAll(otherStore, self, myWant, function (err) {
        // TODO: catch + return error(s)
        if (--pending === 0) return done(err)
      })

      var yourWant = missing(yourNames, myNames)
      console.log('you want', yourWant)
      xferAll(self, otherStore, yourWant, function (err) {
        // TODO: catch + return error(s)
        if (--pending === 0) return done(err)
      })
    })
  })

  function xfer (from, to, name, fin) {
    console.log('gonna xfer', name)
    var ws = to.createWriteStream(name)
    from.createReadStream(name).pipe(ws)
    console.log('xferring', name)
    ws.on('end', function () {
      console.log('xferred', name)
      fin()
    })
    ws.on('error', function (err) {
      fin(err)
    })
  }

  function xferAll (from, to, names, fin) {
    if (names.length === 0) {
      console.log('done xferring')
      return fin()
    }

    var next = names.pop()
    xfer(from, to, next, function (err) {
      if (err) fin(err)
      else xferAll(from, to, names, fin)
    })
  }
}

function nameToSubdir (name, prefixLen) {
  return name.substring(0, Math.min(prefixLen, name.lastIndexOf('.')))
}

// What's in 'b' that is not in 'a'?
// [t], [t] -> [t]
function missing (a, b) {
  var m = []
  var amap = {}
  a.forEach(function (v) { amap[v] = true })

  b.forEach(function (v) {
    if (!amap[v]) {
      m.push(v)
    }
  })

  return m
}
