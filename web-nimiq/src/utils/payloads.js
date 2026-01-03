// Payload parsing utilities for CART, DATA, and CENT formats

/**
 * Parse CART header payload (64 bytes)
 * Format: MAGIC "CART"(4), schema(1), platform(1), chunk_size(1=51), flags(1), 
 *         cartridge_id(u32), total_size(u64), sha256(32), reserved
 */
export function parseCART(data) {
  if (!data || data.length < 64) return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  // Check magic
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'CART') return null
  
  const schema = data[4]
  const platform = data[5]
  const chunkSize = data[6]
  const flags = data[7]
  const cartridgeId = view.getUint32(8, true) // little-endian
  const totalSize = view.getBigUint64(12, true) // little-endian
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
 * Format: MAGIC "DATA"(4), cartridge_id(u32), chunk_index(u32), len(u8), bytes(51)
 */
export function parseDATA(data) {
  if (!data || data.length < 64) return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  // Check magic
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'DATA') return null
  
  const cartridgeId = view.getUint32(4, true) // little-endian
  const chunkIndex = view.getUint32(8, true) // little-endian
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
 * Format: MAGIC "CENT"(4), schema(1), platform(1), flags(1), app_id(u32), 
 *         semver(3 bytes), cartridge_address(20 bytes binary), title_short(16 bytes), reserved
 */
export function parseCENT(data) {
  if (!data || data.length < 64) return null
  
  // Check magic
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'CENT') return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  const schema = data[4]
  const platform = data[5]
  const flags = data[6]
  const appId = view.getUint32(7, true) // little-endian
  const semver = [data[11], data[12], data[13]] // major, minor, patch
  const cartridgeAddress = data.slice(14, 34) // 20 bytes
  const titleBytes = data.slice(34, 50) // 16 bytes
  
  // Extract title (null-terminated or padded)
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

/**
 * Convert Nimiq address string (NQ...) to 20-byte binary
 */
export function addressNQToBytes(address) {
  if (!address || !address.startsWith('NQ')) {
    throw new Error('Invalid Nimiq address format')
  }
  
  // Remove 'NQ' prefix
  const hex = address.slice(2)
  
  if (hex.length !== 40) {
    throw new Error('Invalid address length')
  }
  
  const bytes = new Uint8Array(20)
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  
  return bytes
}

/**
 * Nimiq base32 alphabet (excludes I, O, W, Z to avoid confusion)
 * Same as Go: "0123456789ABCDEFGHJKLMNPQRSTUVXY" (32 characters)
 */
const NIMIQ_BASE32_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

/**
 * Calculate IBAN-style MOD-97 check digits for Nimiq address
 * @param {string} addressBase32 - 32 character base32 encoded address body
 * @returns {string} 2-digit check string (e.g., "29", "34")
 */
function calculateIBANCheck(addressBase32) {
  // IBAN MOD-97-10 algorithm:
  // 1. Rearrange: address_body + "NQ00" (NQ + placeholder 00)
  // 2. Convert letters to numbers: A=10, B=11, ..., Z=35
  // 3. Calculate: 98 - (number mod 97)
  
  const toCheck = addressBase32 + 'NQ00'
  
  let numericString = ''
  for (const char of toCheck) {
    if (char >= '0' && char <= '9') {
      numericString += char
    } else {
      // A=10, B=11, ..., Z=35
      const value = char.charCodeAt(0) - 55
      numericString += value.toString()
    }
  }
  
  // Calculate mod 97 of the large number (process digit by digit to avoid overflow)
  let remainder = 0
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i])) % 97
  }
  
  // Check digits = 98 - remainder, padded to 2 digits
  const check = 98 - remainder
  return check.toString().padStart(2, '0')
}

/**
 * Convert 20-byte binary address to Nimiq address string (NQ...)
 * 
 * Nimiq address format is IBAN-style:
 * - NQ (2 chars) + check digits (2 chars) + address body (32 base32 chars)
 * - Total: 36 characters
 * - Check digits calculated via MOD-97-10 over address body
 */
export function addressBytesToNQ(addressBytes) {
  if (!addressBytes || addressBytes.length !== 20) {
    throw new Error('Invalid address bytes length')
  }
  
  // Step 1: Encode 20 bytes to 32 base32 characters (160 bits / 5 = 32 chars exactly)
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
  
  // 160 bits / 5 = exactly 32 characters, no remainder
  if (addressBase32.length !== 32) {
    throw new Error(`Unexpected base32 length: ${addressBase32.length} (expected 32)`)
  }
  
  // Step 2: Calculate IBAN-style MOD-97 check digits
  const checkDigits = calculateIBANCheck(addressBase32)
  
  // Step 3: Format as NQ + check_digits + address_body
  return 'NQ' + checkDigits + addressBase32
}

/**
 * Normalize Nimiq address for comparison (remove spaces, uppercase)
 */
export function normalizeAddress(address) {
  if (!address) return ''
  return address.replace(/\s/g, '').toUpperCase()
}

/**
 * Compute expected chunk count from total size and chunk size
 */
export function computeExpectedChunks(totalSize, chunkSize = 51) {
  return Math.ceil(totalSize / chunkSize)
}

/**
 * Verify SHA256 hash of data
 */
export async function verifySHA256(data, expectedHash) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex.toLowerCase() === expectedHash.toLowerCase()
}

/**
 * Parse hex string to Uint8Array
 */
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

/**
 * OPTIMIZATION: Quick check if hex data starts with DATA magic
 * Avoids full hexToBytes conversion for non-DATA transactions
 * "DATA" in hex = "44415441"
 */
export function isDataMagicHex(hexString) {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  // Check first 8 hex chars (4 bytes) for "DATA" magic = 0x44415441
  return hex.length >= 8 && hex.slice(0, 8).toUpperCase() === '44415441'
}

/**
 * OPTIMIZATION: Quick check if hex data starts with CART magic
 * "CART" in hex = "43415254"
 */
export function isCartMagicHex(hexString) {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  return hex.length >= 8 && hex.slice(0, 8).toUpperCase() === '43415254'
}

