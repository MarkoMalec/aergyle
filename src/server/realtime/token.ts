import crypto from "crypto";

function base64urlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecodeToBuffer(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(b64 + pad, "base64");
}

export type RealtimeTokenPayload = {
  sub: string; // userId
  exp: number; // unix seconds
};

export function signRealtimeToken(payload: RealtimeTokenPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64urlEncode(JSON.stringify(header));
  const payloadPart = base64urlEncode(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest();

  return `${data}.${base64urlEncode(signature)}`;
}

export function verifyRealtimeToken(token: string, secret: string): RealtimeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const data = `${headerPart}.${payloadPart}`;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest();

  const gotSig = base64urlDecodeToBuffer(signaturePart);

  // timing-safe compare
  if (gotSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(gotSig, expectedSig)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(base64urlDecodeToBuffer(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("sub" in payload) ||
    !("exp" in payload) ||
    typeof (payload as any).sub !== "string" ||
    typeof (payload as any).exp !== "number"
  ) {
    return null;
  }

  const exp = (payload as any).exp as number;
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) return null;

  return payload as RealtimeTokenPayload;
}
