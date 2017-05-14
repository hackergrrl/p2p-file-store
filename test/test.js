var tapeTest = require('tape')
var Store = require('../')
var tmp = require('tmp-dir')
var fs = require('fs')
var path = require('path')

function test (name, run) {
  var fn = tapeTest(name, function (t) {
    tmp(function (err, dir, cleanup) {
      if (err) throw new Error('failed to create temp dir for test ' + name)
      run(t, dir, cleanup)
    })
  })
}

// - read/write: write file and confirm subdir + file exists + contents
test('read/write', function (t, dir, done) {
  var root = path.join(dir, '1')
  var store = Store(root)

  var ws = store.createWriteStream('2010-01-01_foo.png')
  ws.on('finish', check)
  ws.on('error', function (err) {
    t.error(err)
  })
  ws.write('hello')
  ws.end()

  function check () {
    t.ok(fs.existsSync(path.join(root, '2010-01')))
    t.equal(fs.readFileSync(path.join(root, '2010-01', '2010-01-01_foo.png'), 'utf8'), 'hello')
    done()
    t.end()
  }
})

// - replicateStore: empty <-> empty
test('empty <-> empty', function (t, dir, done) {
  var root1 = path.join(dir, '1')
  var store1 = Store(root1)
  var root2 = path.join(dir, '2')
  var store2 = Store(root2)

  store1.replicateStore(store2, check)

  function check (err) {
    t.error(err)
    done()
    t.end()
  }
})

// - replicateStore: 3 files <-> empty
// - replicateStore: 3 files <-> 2 files

