import { z } from "zod";

/**
 * Account rules shared by the sign-in/registration forms and the server, so a
 * form can never accept something the server then rejects.
 */

export const PLAYER_NAME_MIN = 3;
export const PLAYER_NAME_MAX = 20;
export const PASSWORD_MIN = 8;
// bcrypt ignores everything after 72 bytes, so a longer password would give
// a false sense of strength.
export const PASSWORD_MAX_BYTES = 72;
/** bcrypt cost for player passwords; older hashes are upgraded at sign-in. */
export const PASSWORD_BCRYPT_ROUNDS = 11;
export const EMAIL_MAX = 254;

// Letters and digits in any script, plus a few separators. No emoji, control
// or zero-width characters, so names stay readable and hard to spoof.
const NAME_PATTERN =
  /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}' ._-]*[\p{L}\p{M}\p{N}])?$/u;
const NAME_DISALLOWED = /[^\p{L}\p{M}\p{N}' ._-]/gu;

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).length;
}

/** Trims, drops disallowed characters and collapses repeated separators. */
export function sanitizePlayerName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(NAME_DISALLOWED, "")
    .replace(/\s+/g, " ")
    .replace(/([' ._-])[' ._-]+/g, "$1")
    .replace(/^[\p{M}' ._-]+|[' ._-]+$/gu, "")
    .slice(0, PLAYER_NAME_MAX)
    .replace(/[' ._-]+$/g, "");
}

export const playerNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(PLAYER_NAME_MIN, `Use at least ${PLAYER_NAME_MIN} characters.`)
      .max(PLAYER_NAME_MAX, `Use at most ${PLAYER_NAME_MAX} characters.`)
      .regex(
        NAME_PATTERN,
        "Use letters, numbers, spaces and - _ . ' (starting and ending with a letter or number).",
      ),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, "That email address is too long.")
  .email("Enter a valid email address.");

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .refine(
    (value) => utf8Bytes(value) <= PASSWORD_MAX_BYTES,
    "That password is too long.",
  );

/** Sign-in only checks shape: older accounts may predate the length rule. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(256, "That password is too long."),
});

export const registerSchema = z.object({
  name: playerNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.input<typeof registerSchema>;

/**
 * A post-login destination taken from the URL. Only same-site paths are
 * allowed, so a crafted link can't bounce a player to another site.
 */
export function safeCallbackPath(
  value: string | null | undefined,
  fallback = "/profile",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
