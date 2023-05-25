import { base58btc } from 'multiformats/bases/base58'
import { u8 } from 'iso-base/utils'
import { tag, varint } from 'iso-base/varint'
import { DIDCore } from './core.js'
import * as EC from 'iso-base/ec-compression'

/* eslint-disable unicorn/numeric-separators-style */
const TYPE_CODE = /** @type {const} */ ({
  Ed25519: 0xed,
  RSA: 0x1205,
  'P-256': 0x1200,
  'P-384': 0x1201,
  'P-521': 0x1202,
  secp256k1: 0xe7,
})

const CODE_TYPE = /** @type {const} */ ({
  0xed: 'Ed25519',
  0x1205: 'RSA',
  0x1200: 'P-256',
  0x1201: 'P-384',
  0x1202: 'P-521',
  0xe7: 'secp256k1',
})

/**
 * @typedef {TYPE_CODE[keyof TYPE_CODE]} Code
 * @typedef {keyof TYPE_CODE} KeyType
 */

const DID_KEY_PREFIX = `did:key:`

/**
 * Validate raw public key length
 *
 * @param {number} code
 * @param {Uint8Array} key
 */
function validateRawPublicKeyLength(code, key) {
  switch (code) {
    case TYPE_CODE.secp256k1: {
      if (key.length !== 33) {
        throw new RangeError(`Secp256k1 public keys must be 33 bytes.`)
      }
      return key
    }
    case TYPE_CODE.Ed25519: {
      if (key.length !== 32) {
        throw new RangeError(`ed25519 public keys must be 32 bytes.`)
      }
      return key
    }
    case TYPE_CODE['P-256']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }

      if (EC.isCompressed(key) && key.length !== 33) {
        throw new RangeError(`p256 public keys must be 33 bytes.`)
      }

      return key
    }
    case TYPE_CODE['P-384']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 49) {
        throw new RangeError(`p384 public keys must be 49 bytes.`)
      }
      return key
    }
    case TYPE_CODE['P-521']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 67) {
        throw new RangeError(`p521 public keys must be 67 bytes.`)
      }
      return key
    }

    case TYPE_CODE.RSA: {
      if (key.length !== 270 && key.length !== 526) {
        throw new RangeError(
          `RSA public keys must be 270 bytes for 2048 bits or 526 bytes for 4096 bits.`
        )
      }
      return key
    }
    default: {
      throw new RangeError(
        `Unsupported DID encoding, unknown multicode 0x${code.toString(16)}.`
      )
    }
  }
}

/**
 * did:key Method
 */
export class DIDKey extends DIDCore {
  /**
   *
   * @param {import('./types').DID} did
   * @param {KeyType} type
   * @param {Uint8Array} key
   */
  constructor(did, type, key) {
    super(did)
    this.type = type
    this.publicKey = key
    this.code = TYPE_CODE[type]
  }

  /**
   * Create a DIDKey from a DID string
   *
   * @param {string} didString
   */
  static fromString(didString) {
    const did = DIDCore.fromString(didString)

    if (did.method === 'key') {
      const encodedKey = base58btc.decode(did.id)
      const [code, size] = varint.decode(encodedKey)
      const key = validateRawPublicKeyLength(code, encodedKey.slice(size))

      return new DIDKey(did, CODE_TYPE[/** @type {Code} */ (code)], key)
    } else {
      throw new TypeError(`Invalid DID "${did}", method must be 'key'`)
    }
  }

  /**
   * Create a DIDKey from a public key bytes
   *
   * @param {KeyType} type
   * @param {BufferSource} key
   */
  static fromPublicKey(type, key) {
    const code = TYPE_CODE[type]
    if (!code) {
      throw new TypeError(`Unsupported key type "${type}"`)
    }

    const keyBytes = validateRawPublicKeyLength(code, u8(key))
    const id = base58btc.encode(tag(code, keyBytes))

    return new DIDKey(
      {
        did: `${DID_KEY_PREFIX}${id}`,
        didUrl: `${DID_KEY_PREFIX}${id}`,
        id,
        method: 'key',
      },
      type,
      keyBytes
    )
  }
}
