module.exports = MediaStore

var Store = require('fs-blob-store')
var fs = require('fs')

function MediaStore (dir, opts) {
  if (!(this instanceof MediaStore)) return new MediaStore(dir, opts)

  // TODO: expose whether to use subdirs opt
  // TODO: expose subdir prefix length opt

  this._dir = dir
  this._store = Store(dir)
}

MediaStore.prototype.createReadStream = function (name) {
  return this._store.createReadStream(name)
}

MediaStore.prototype.createWriteStream = function (name) {
  return this._store.createWriteStream(name)
}

MediaStore.prototype.list = function (cb) {
  fs.readdir(this._dir, function (err, files) {
    if (err && err.code === 'ENOENT') cb(null, [])
    else if (err) cb(err)
    else cb(null, files)
  })
}

MediaStore.prototype.replicateStore = function (otherStore, done) {
  var pending = 2
  var self = this

  this.list(function (err, myNames) {
    if (err) return done(err)
    otherStore.list(function (err, yourNames) {
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
