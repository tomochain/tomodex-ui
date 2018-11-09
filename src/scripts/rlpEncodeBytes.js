const { utils } = require('ethers')

function arrayifyInteger(value) {
  var result = []
  while (value) {
    result.unshift(value & 0xff)
    value >>= 8
  }
  return result
}

function toBinary(x) {
  if (x === 0) {
    return 0
  }
  return toBinary(Math.round(x / 256)) + (x % 256)
}

function encodeLength(L, offset) {
  if (L < 56) {
    return L + offset
  }

  const BL = toBinary(L)
  return BL.length + offset + 55 + BL
}

const shift_1 = 1 << 8
const shift_2 = 1 << 16
const shift_3 = 1 << 24

function byte(i) {
  return i & 0x000000ff
}

// putint writes i to the beginning of b in big endian byte
// order, using the least number of bytes needed to represent i.
function putint(b, i) {
  if (i < shift_1) {
    b[0] = byte(i)
    return 1
  }

  if (i < shift_2) {
    b[0] = byte(i >> 8)
    b[1] = byte(i)
    return 2
  }

  if (i < shift_3) {
    b[0] = byte(i >> 16)
    b[1] = byte(i >> 8)
    b[2] = byte(i)
    return 3
  }

  b[0] = byte(i >> 24)
  b[1] = byte(i >> 16)
  b[2] = byte(i >> 8)
  b[3] = byte(i)
  return 4
}

function rlpEncode(object) {
  const type = typeof object
  let lengthArr
  // console.log(type);
  switch (type) {
    case 'boolean':
      return [object ? 0x01 : 0x80]
    case 'number':
      if (object === 0) {
        return [0x80]
      } else if (object < 128) {
        // fits single byte
        return [object]
      } else {
        // TODO: encode int to w.str directly
        const buf = new Array(8)
        const s = putint(buf, object)
        // console.log('s: ' + s, [0x80 + byte(s), ...buf.slice(0, s)]);
        return [0x80 + byte(s), ...buf.slice(0, s)]
      }
    case 'string':
      if (!object.startsWith('0x')) {
        const strBytes = utils.toUtf8Bytes(object)
        if (strBytes.length === 1 && strBytes[0] <= 0x7f) {
          // fits single byte, no string header
          return [strBytes[0]]
        } else {
          return [encodeLength(strBytes.length, 0x80), ...strBytes]
        }
      }
      // we got hex string here
      var data = Array.prototype.slice.call(utils.arrayify(object))
      if (data.length === 1 && data[0] <= 0x7f) {
        return data
      } else if (data.length <= 55) {
        data.unshift(0x80 + data.length)
        return data
      }
      lengthArr = arrayifyInteger(data.length)
      lengthArr.unshift(0xb7 + lengthArr.length)
      return lengthArr.concat(data)
    // case 'object':
    default:
      var payload = []
      for (let key in object) {
        const child = object[key]
        payload = payload.concat(rlpEncode(child))
      }
      if (payload.length <= 55) {
        payload.unshift(0xc0 + payload.length)
        return payload
      }
      lengthArr = arrayifyInteger(payload.length)
      lengthArr.unshift(0xf7 + lengthArr.length)
      return lengthArr.concat(payload)
  }
}

module.exports = function(object) {
  const bytes = rlpEncode(object)
  return new Uint8Array(bytes)
}
