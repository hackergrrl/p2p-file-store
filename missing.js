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

module.exports = missing
