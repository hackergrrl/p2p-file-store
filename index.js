module.exports = MediaStore

var Store = require('fs-blob-store')
var fs = require('fs')

function MediaStore (dir) {
  if (!(this instanceof MediaStore)) return new MediaStore(dir)

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

MediaStore.prototype.replicateStore = function (otherStore) {
  // TODO: handle errors
  this.list(function (err, myNames) {
    otherStore.list(function (err, yourNames) {
      var myWant = missing(myNames, yourNames)
      console.log('I want', myWant)

      var yourWant = missing(yourNames, myNames)
      console.log('you want', yourWant)
    })
  })
}

// What's in 'b' that is not in 'a'?
// [t], [t] -> [t]
function missing (a, b) {
  var m = []
  var amap = {}
  a.forEach(function (v) { amap[a] = true })

  b.forEach(function (v) {
    if (!amap[v]) {
      m.push(v)
    }
  })

  return m
}
