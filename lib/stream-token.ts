import { createHmac, timingSafeEqual } from "crypto";

// Short-lived, session-bound, single-file tokens gate the video stream so a
// raw stream URL copied by a download extension or pasted elsewhere is useless:
// it expires in minutes and only works for the user + file it was minted for.
// Long enough for a full lesson without mid-watch re-auth; still short-lived vs permanent URLs.
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required to sign stream tokens.");
  return value;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createStreamToken(fileId: string, userKey: string) {
  const payload = { f: fileId, u: userKey, e: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyStreamToken(token: string | null, fileId: string, userKey: string) {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;

  const expected = sign(body);
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { f: string; u: string; e: number };
    return payload.f === fileId && payload.u === userKey && Date.now() <= payload.e;
  } catch {
    return false;
  }
}
