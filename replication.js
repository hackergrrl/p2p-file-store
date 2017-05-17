var lpstream = require('length-prefixed-stream')
var duplexify = require('duplexify')
var collect = require('collect-stream')
var missing = require('./missing')
var debug = require('debug')('p2p-file-store-replication')

function noop () {}

module.exports = function (store, opts) {
  opts = opts || {}
  var ID = Math.round(Math.random() * 50)

  var progressFn = opts.progressFn || noop
  var filesToXfer = 0
  var filesXferred = 0

  var encoder = lpstream.encode()
  var decoder = lpstream.decode()

  var dup = duplexify(decoder, encoder)
  var localHaves = null
  var remoteHaves = null

  var state = 'wait-remote-haves'
  var numFilesToRecv = null
  var pendingFilename = null
  var filesSent = false
  var filesReceived = false
  function onData (data) {
    switch (state) {
      case 'wait-remote-haves':
        state = 'wait-remote-wants'
        handleRemoteHaves(data)
        sendWants()
        break
      case 'wait-remote-wants':
        state = 'wait-remote-files-length'
        var remoteWants = handleRemoteWants(data)
        filesToXfer += remoteWants.length
        sendRequested(remoteWants, function () {
          debug('' + ID, 'ALL SENT')
          filesSent = true
          if (filesReceived) terminate()
        })
        break
      case 'wait-remote-files-length':
        state = 'wait-remote-file-name'
        numFilesToRecv = Number(JSON.parse(data.toString()))
        debug('got # of remote files incoming', numFilesToRecv)
        break
      case 'wait-remote-file-name':
        state = 'wait-remote-file-data'
        pendingFilename = data.toString()
        debug('got a filename', pendingFilename)
        break
      case 'wait-remote-file-data':
        var fn = pendingFilename
        debug('recving a remote file', fn)
        var ws = store.createWriteStream(fn, function (err) {
          // TODO: handle error
          filesXferred++ && emitProgress()
          debug('recv\'d a remote file', fn)
          if (--numFilesToRecv === 0) {
            debug('' + ID, 'ALL RECEIVED')
            filesReceived = true
            if (filesSent) terminate()
          }
        })
        ws.end(data)

        state = 'wait-remote-file-name'
        break
    }
  }

  function terminate () {
    debug('TERMINATING')
    // TODO: terminate replication
    encoder.end()
    debug('' + ID, 'replication done')
  }

  store._list(function (err, names) {
    if (err) {
      // TODO: handle error case
    } else {
      debug('' + ID, 'lhave', names)
      localHaves = names

      sendHaves()
    }
  })

  function sendHaves () {
    // send local haves
    debug('' + ID, 'sent local haves')
    encoder.write(JSON.stringify(localHaves))

    // begin reading
    decoder.on('data', onData)
  }

  function handleRemoteHaves (data) {
    debug('' + ID, 'got remote haves', data.toString())
    remoteHaves = JSON.parse(data.toString())
  }

  function sendWants () {
    // send local wants
    var wants = missing(localHaves, remoteHaves)
    filesToXfer += wants.length
    debug('' + ID, 'wrote local wants', JSON.stringify(wants))
    encoder.write(JSON.stringify(wants))
  }

  function handleRemoteWants (data) {
    // recv remote wants
    debug('' + ID, 'got remote wants', data.toString())
    return JSON.parse(data.toString())
  }

  function sendRequested (toSend, done) {
    var pending = toSend.length

    debug('' + ID, 'writing', pending)
    encoder.write(JSON.stringify(pending))
    debug('' + ID, 'wrote # of entries count')

    toSend.forEach(function (name) {
      debug('' + ID, 'collecting', name)
      collect(store.createReadStream(name), function (err, data) {
        encoder.write(name)
        encoder.write(data)

        filesXferred++ && emitProgress()

        debug('' + ID, 'collected + wrote locally', name, err, data && data.length)
        if (--pending === 0) done()
      })
    })
  }

  return dup

  function emitProgress () {
    progressFn(filesXferred / filesToXfer)
  }
}
