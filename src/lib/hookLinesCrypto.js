/**
 * Serverless-safe transport for hook_lines.
 *
 * The playlist API route encrypts hook_lines into an opaque token that is
 * returned to the client alongside each song. The client holds the token and
 * passes it back when calling /api/mangle and /api/songs/[id]/reveal. Those
 * routes decrypt it server-side without needing any shared state (no Redis,
 * no globalThis cache) — making the app safe on multi-instance / serverless
 * deployments such as Vercel.
 *
 * Encryption: AES-256-GCM with a random 12-byte IV per token.
 * Key: derived from HOOK_LINES_SECRET via scrypt (falls back to a dev-only
 * constant — set the real secret in production env vars).
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const SALT = 'hook-lines-v1'

let _key = null
function getKey() {
  if (_key) return _key
  const secret = process.env.HOOK_LINES_SECRET ?? 'dev-only-fallback-change-me-in-prod'
  _key = scryptSync(secret, SALT, 32)
  return _key
}

/**
 * Encrypts an array of hook_lines strings into a URL-safe opaque token.
 * @param {string[]} lines
 * @returns {string}
 */
export function encryptHookLines(lines) {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const plaintext = JSON.stringify(lines)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, encrypted].map(b => b.toString('base64url')).join('.')
}

/**
 * Decrypts a token produced by encryptHookLines.
 * Returns the lines array on success, or null if the token is invalid / tampered.
 * @param {string} token
 * @returns {string[] | null}
 */
export function decryptHookLines(token) {
  try {
    if (typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [iv, authTag, encrypted] = parts.map(p => Buffer.from(p, 'base64url'))
    const decipher = createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    const lines = JSON.parse(decrypted.toString('utf8'))
    if (!Array.isArray(lines)) return null
    return lines
  } catch {
    return null
  }
}
