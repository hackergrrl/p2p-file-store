var MediaStore = require('./')

var store1 = MediaStore('/tmp/media-one')
var store2 = MediaStore('/tmp/media-two')

var pending = 2

var ws1 = store1.createWriteStream('foo_bar.png', doneWriting)
ws1.end('hello')

var ws2 = store2.createWriteStream('baz_bax.png', doneWriting)
ws2.end('greetings')

function doneWriting () {
  if (--pending === 0) {
    replicate()
  }
}

function replicate () {
  store1.replicateStore(store2, function () {
    store2.createReadStream('foo_bar.png').pipe(process.stdout)
  })
}
