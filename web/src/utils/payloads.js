/**
 * Payload parsing utilities for CART, DATA, and CENT formats (Nimiq)
 */

/**
 * Parse CART header payload (64 bytes)
 */
export function parseCART(data) {
  if (!data || data.length < 64) return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'CART') return null
  
  const schema = data[4]
  const platform = data[5]
  const chunkSize = data[6]
  const flags = data[7]
  const cartridgeId = view.getUint32(8, true)
  const totalSize = view.getBigUint64(12, true)
  const sha256 = Array.from(data.slice(20, 52))
  
  return {
    magic,
    schema,
    platform,
    chunkSize,
    flags,
    cartridgeId,
    totalSize: Number(totalSize),
    sha256: sha256.map(b => b.toString(16).padStart(2, '0')).join(''),
    raw: data
  }
}

/**
 * Parse DATA chunk payload (64 bytes)
 */
export function parseDATA(data) {
  if (!data || data.length < 64) return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'DATA') return null
  
  const cartridgeId = view.getUint32(4, true)
  const chunkIndex = view.getUint32(8, true)
  const len = data[12]
  
  if (len > 51 || data.length < 13 + len) return null
  
  const chunkData = data.slice(13, 13 + len)
  
  return {
    magic,
    cartridgeId,
    chunkIndex,
    len,
    data: chunkData
  }
}

/**
 * Parse CENT catalog entry payload (64 bytes)
 */
export function parseCENT(data) {
  if (!data || data.length < 64) return null
  
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'CENT') return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  const schema = data[4]
  const platform = data[5]
  const flags = data[6]
  const appId = view.getUint32(7, true)
  const semver = [data[11], data[12], data[13]]
  const cartridgeAddress = data.slice(14, 34)
  const titleBytes = data.slice(34, 50)
  
  let title = ''
  for (let i = 0; i < titleBytes.length; i++) {
    if (titleBytes[i] === 0) break
    title += String.fromCharCode(titleBytes[i])
  }
  
  return {
    magic,
    schema,
    platform,
    flags,
    appId,
    semver: {
      major: semver[0],
      minor: semver[1],
      patch: semver[2],
      string: `${semver[0]}.${semver[1]}.${semver[2]}`
    },
    cartridgeAddress: addressBytesToNQ(cartridgeAddress),
    cartridgeAddressBytes: cartridgeAddress,
    title: title.trim() || null,
    raw: data
  }
}

const NIMIQ_BASE32_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

function calculateIBANCheck(addressBase32) {
  const toCheck = addressBase32 + 'NQ00'
  
  let numericString = ''
  for (const char of toCheck) {
    if (char >= '0' && char <= '9') {
      numericString += char
    } else {
      const value = char.charCodeAt(0) - 55
      numericString += value.toString()
    }
  }
  
  let remainder = 0
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i])) % 97
  }
  
  const check = 98 - remainder
  return check.toString().padStart(2, '0')
}

export function addressBytesToNQ(addressBytes) {
  if (!addressBytes || addressBytes.length !== 20) {
    throw new Error('Invalid address bytes length')
  }
  
  let bits = 0
  let bitCount = 0
  let addressBase32 = ''
  
  for (let i = 0; i < 20; i++) {
    bits = (bits << 8) | addressBytes[i]
    bitCount += 8
    
    while (bitCount >= 5) {
      const index = (bits >> (bitCount - 5)) & 0x1F
      addressBase32 += NIMIQ_BASE32_ALPHABET[index]
      bitCount -= 5
      bits &= (1 << bitCount) - 1
    }
  }
  
  if (addressBase32.length !== 32) {
    throw new Error(`Unexpected base32 length: ${addressBase32.length}`)
  }
  
  const checkDigits = calculateIBANCheck(addressBase32)
  
  return 'NQ' + checkDigits + addressBase32
}

export function normalizeAddress(address) {
  if (!address) return ''
  return address.replace(/\s/g, '').toUpperCase()
}

export function computeExpectedChunks(totalSize, chunkSize = 51) {
  return Math.ceil(totalSize / chunkSize)
}

export async function verifySHA256(data, expectedHash) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex.toLowerCase() === expectedHash.toLowerCase()
}

export function hexToBytes(hexString) {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }
  
  const data = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    data[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  
  return data
}

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function isDataMagicHex(hexString) {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  return hex.length >= 8 && hex.slice(0, 8).toUpperCase() === '44415441'
}

export function isCartMagicHex(hexString) {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  return hex.length >= 8 && hex.slice(0, 8).toUpperCase() === '43415254'
}

