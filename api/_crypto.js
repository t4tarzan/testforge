// Symmetric encryption for secrets stored at rest (managed BYOK: a user's own
// OpenRouter key). AES-256-GCM. The key is DERIVED from SESSION_SECRET via HKDF
// with a domain-separation label, so there is no new env var to configure — if
// the app can sign sessions it can encrypt BYOK keys. Rotating SESSION_SECRET
// invalidates stored BYOK keys (users just re-enter them), which is acceptable.
import crypto from 'crypto';

function aesKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    const e = new Error('SESSION_SECRET (>=32 chars) is required to encrypt BYOK keys');
    e.statusCode = 500;
    throw e;
  }
  // 32-byte AES key, domain-separated from the JWT use of SESSION_SECRET.
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from('testforge-byok-v1'), 32));
}

/** Encrypt → base64(iv[12] | tag[16] | ciphertext). */
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** Display-safe mask: sk-or-v…1234. Never returns enough to reconstruct. */
export function maskKey(k) {
  if (!k) return null;
  return k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '••••';
}
