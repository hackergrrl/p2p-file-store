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
  fs.readdir(this._dir, cb)
}

MediaStore.prototype.replicateStore = function (otherStore) {
}

