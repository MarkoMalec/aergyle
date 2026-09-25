import crypto from "crypto";
import { promisify } from "util";

/**
 * Time-based one-time passwords (RFC 6238) as every authenticator app reads
 * them: SHA-1, 6 digits, 30-second steps. Kept free of Next imports so the
 * admin CLI and the tests can use it too.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh 160-bit secret, the size RFC 4226 recommends. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** The code for one counter value (RFC 4226 HOTP). */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCounter(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * Checks a code against the current step and one step either side (phone
 * clocks drift). Returns the matching counter so the caller can refuse to
 * accept the same code twice, or null when nothing matches.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { nowMs?: number; window?: number } = {},
): number | null {
  const normalized = code.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalized)) return null;

  const secret = base32Decode(secretBase32);
  const current = totpCounter(options.nowMs);
  const window = options.window ?? 1;
  const given = Buffer.from(normalized);
  let matched: number | null = null;

  // Compare every candidate so timing doesn't reveal which step matched.
  for (let offset = -window; offset <= window; offset++) {
    const expected = Buffer.from(hotp(secret, current + offset));
    if (crypto.timingSafeEqual(expected, given) && matched === null) {
      matched = current + offset;
    }
  }
  return matched;
}

/** The otpauth:// link an authenticator app reads from a QR code. */
export function totpUri(params: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* Storing the secret                                                          */
/* -------------------------------------------------------------------------- */

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function toB64(bytes: Buffer) {
  return bytes.toString("base64url");
}

/**
 * Encrypts the secret with a key derived from the admin's password, so a copy
 * of the database alone doesn't reveal it: the second factor stays secret
 * unless the password is known too. Changing the password means enrolling a
 * new secret.
 */
export async function sealTotpSecret(
  secretBase32: string,
  password: string,
): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 32, SCRYPT_OPTIONS);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const sealed = Buffer.concat([
    cipher.update(secretBase32, "utf8"),
    cipher.final(),
  ]);
  return ["v1", toB64(salt), toB64(iv), toB64(cipher.getAuthTag()), toB64(sealed)].join(".");
}

/** The secret sealed above, or null when the password or data is wrong. */
export async function openTotpSecret(
  sealed: string,
  password: string,
): Promise<string | null> {
  const [version, salt, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !salt || !iv || !tag || !data) return null;
  try {
    const key = await scrypt(
      password,
      Buffer.from(salt, "base64url"),
      32,
      SCRYPT_OPTIONS,
    );
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
