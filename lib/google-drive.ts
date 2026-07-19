import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readFile, rename } from "fs/promises";
import { resolve } from "path";
import { prisma } from "@/lib/prisma";

type GoogleTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type StoredTokens = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  accountEmail?: string;
  accountName?: string;
  source?: "database" | "environment" | "legacy";
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const LOGIN_SCOPES = ["openid", "email", "profile"];
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_STATE_MAX_AGE_MS = 15 * 60 * 1000;
const STORAGE_PROVIDER = "google-drive";
const LEGACY_TOKEN_PATH = resolve(process.cwd(), ".data", "google-drive-token.json");
const LEGACY_EXPIRED_TOKEN_PATH = resolve(process.cwd(), ".data", "google-drive-token.expired.json");

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(required("NEXTAUTH_SECRET")).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(value: string) {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REDIRECT_URI);
}

function redirectUri(requestOrigin?: string) {
  const configuredUri = required("GOOGLE_DRIVE_REDIRECT_URI");
  if (!requestOrigin || !process.env.VERCEL) return configuredUri;

  try {
    const saved = new URL(configuredUri);
    if (saved.hostname !== "localhost" && saved.hostname !== "127.0.0.1") return configuredUri;
    return new URL("/api/google-drive/callback", requestOrigin).toString();
  } catch {
    return new URL("/api/google-drive/callback", requestOrigin).toString();
  }
}

async function readStore(): Promise<StoredTokens | null> {
  try {
    const stored = await prisma.storageConnection.findUnique({ where: { provider: STORAGE_PROVIDER } });
    if (stored) {
      return {
        refreshToken: decrypt(stored.encryptedRefreshToken),
        accountEmail: stored.accountEmail || undefined,
        accountName: stored.accountName || undefined,
        source: "database",
      };
    }
  } catch {
    // Environment and legacy fallbacks below keep Drive usable while the database is being configured.
  }

  const environmentToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
  if (environmentToken) {
    return {
      refreshToken: environmentToken,
      accountEmail: process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL?.trim() || undefined,
      accountName: process.env.GOOGLE_DRIVE_ACCOUNT_NAME?.trim() || undefined,
      source: "environment",
    };
  }

  if (!process.env.VERCEL) {
    try {
      const legacy = JSON.parse(await readFile(LEGACY_TOKEN_PATH, "utf8")) as Partial<StoredTokens>;
      if (legacy.refreshToken) {
        const restored: StoredTokens = {
          refreshToken: legacy.refreshToken,
          accessToken: legacy.accessToken,
          expiresAt: legacy.expiresAt,
          accountEmail: legacy.accountEmail,
          accountName: legacy.accountName,
          source: "legacy",
        };
        await writeStore(restored).catch(() => undefined);
        return restored;
      }
    } catch {
      // A missing legacy file simply means Drive still needs authorization.
    }
  }

  return null;
}

async function writeStore(tokens: StoredTokens) {
  const data = {
    encryptedRefreshToken: encrypt(tokens.refreshToken),
    accountEmail: tokens.accountEmail || null,
    accountName: tokens.accountName || null,
  };
  await prisma.storageConnection.upsert({ where: { provider: STORAGE_PROVIDER }, create: { provider: STORAGE_PROVIDER, ...data }, update: data });
}

async function quarantineLegacyToken() {
  if (process.env.VERCEL) return;
  try {
    await rename(LEGACY_TOKEN_PATH, LEGACY_EXPIRED_TOKEN_PATH);
  } catch {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await rename(LEGACY_TOKEN_PATH, resolve(process.cwd(), ".data", `google-drive-token.expired-${timestamp}.json`));
    } catch {
      // Missing or locked legacy files should not block a clean reconnect.
    }
  }
}

async function invalidateStoredConnection(source?: StoredTokens["source"]) {
  if (source !== "environment") {
    await prisma.storageConnection.deleteMany({ where: { provider: STORAGE_PROVIDER } }).catch(() => undefined);
    await quarantineLegacyToken();
  }
}

async function exchangeCode(code: string, requestOrigin?: string) {
  const body = new URLSearchParams({
    code,
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    redirect_uri: redirectUri(requestOrigin),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const tokens = await response.json() as GoogleTokens & { error?: string; error_description?: string };
  if (!response.ok) throw new Error(tokens.error_description || tokens.error || "Google token exchange failed.");
  return tokens;
}

async function refreshAccessToken(stored: StoredTokens) {
  if (stored.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000) return stored;
  const body = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    refresh_token: stored.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const tokens = await response.json() as GoogleTokens & { error?: string; error_description?: string };
  if (!response.ok || !tokens.access_token) {
    const detail = tokens.error_description || tokens.error || "Google Drive needs to be reconnected.";
    if (tokens.error === "invalid_grant" || tokens.error === "invalid_client" || detail === "Bad Request") {
      await invalidateStoredConnection(stored.source);
      throw new Error("The previous Google Drive authorization expired or was revoked. Connect Drive again to restore access.");
    }
    throw new Error(detail);
  }
  const next = { ...stored, accessToken: tokens.access_token, expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000 };
  await writeStore(next);
  return next;
}

function driveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureDriveFolder(accessToken: string, name: string) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${driveQueryValue(name)}' and trashed=false`;
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!list.ok) {
    const body = await list.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || "Google Drive folder lookup failed.");
  }
  const found = await list.json() as { files?: Array<{ id: string; name: string }> };
  if (found.files?.[0]?.id) return found.files[0].id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!create.ok) {
    const body = await create.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || "Google Drive folder creation failed.");
  }
  const folder = await create.json() as { id?: string };
  if (!folder.id) throw new Error("Google Drive did not return a folder id.");
  return folder.id;
}

export function adminEmails() {
  return (process.env.GOOGLE_ADMIN_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
}

export function roleForEmail(email?: string | null) {
  if (!email) return "free";
  return adminEmails().includes(email.toLowerCase()) ? "admin" : "free";
}

function safeCallbackUrl(callbackUrl?: string) {
  return callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
}

export function googleAuthUrl(mode: "login" | "drive", callbackUrl?: string, requestOrigin?: string) {
  if (!configured()) throw new Error("Google OAuth is not configured.");
  const statePayload = Buffer.from(JSON.stringify({
    mode,
    callbackUrl: safeCallbackUrl(callbackUrl),
    issuedAt: Date.now(),
    nonce: randomBytes(12).toString("hex"),
  })).toString("base64url");
  const stateSignature = createHmac("sha256", required("NEXTAUTH_SECRET")).update(statePayload).digest("base64url");
  const state = `${statePayload}.${stateSignature}`;
  const params = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(requestOrigin),
    response_type: "code",
    scope: (mode === "drive" ? [...LOGIN_SCOPES, DRIVE_SCOPE] : LOGIN_SCOPES).join(" "),
    access_type: "offline",
    prompt: mode === "drive" ? "consent" : "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseGoogleState(state: string | null) {
  if (!state) throw new Error("Missing Google OAuth state.");

  try {
    const [payload, signature, extra] = state.split(".");
    if (!payload || !signature || extra) throw new Error("Malformed state.");
    const expected = createHmac("sha256", required("NEXTAUTH_SECRET")).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid signature.");

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { mode?: string; callbackUrl?: string; issuedAt?: number };
    if (!parsed.issuedAt || parsed.issuedAt > Date.now() + 60_000 || Date.now() - parsed.issuedAt > GOOGLE_STATE_MAX_AGE_MS) {
      throw new Error("Expired state.");
    }
    return {
      mode: parsed.mode === "drive" ? "drive" as const : "login" as const,
      callbackUrl: safeCallbackUrl(parsed.callbackUrl),
    };
  } catch {
    throw new Error("Invalid or expired Google OAuth state.");
  }
}

export async function completeGoogleOAuth(code: string, connectDrive: boolean, requestOrigin?: string) {
  const tokens = await exchangeCode(code, requestOrigin);
  if (!tokens.access_token) throw new Error("Google did not return an access token.");
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json() as { email?: string; name?: string; id?: string };
  if (!profileResponse.ok || !profile.email) throw new Error("Google did not return a verified email profile.");

  if (connectDrive) {
    if (roleForEmail(profile.email) !== "admin") throw new Error("An administrator Google account is required to connect Drive.");
    if (!tokens.refresh_token) {
      const previous = await readStore();
      if (!previous?.refreshToken) throw new Error("Google did not return a refresh token. Remove this app from Google Account permissions and connect again.");
      tokens.refresh_token = previous.refreshToken;
    }
    await writeStore({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      accountEmail: profile.email,
      accountName: profile.name,
    });
  }

  return profile;
}

function driveFolderName() {
  return process.env.GOOGLE_DRIVE_FOLDER || "EdgeLedger Content";
}

export async function googleDriveStatus() {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_REDIRECT_URI"].filter(name => !process.env[name]);
  const stored = missing.length ? null : await readStore();
  return {
    configured: missing.length === 0,
    connected: Boolean(stored?.refreshToken),
    missing,
    folder: driveFolderName(),
    accountEmail: stored?.accountEmail || null,
    accountName: stored?.accountName || null,
  };
}

export async function listGoogleDriveFiles() {
  const status = await googleDriveStatus();
  if (!status.configured) return { ...status, files: [] as GoogleDriveFile[], folderId: null };
  const stored = await readStore();
  if (!stored) return { ...status, files: [] as GoogleDriveFile[], folderId: null };

  const tokens = await refreshAccessToken(stored);
  const folderId = await ensureDriveFolder(tokens.accessToken || "", status.folder);
  const query = `'${driveQueryValue(folderId)}' in parents and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    spaces: "drive",
    orderBy: "modifiedTime desc",
    pageSize: "25",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || "Google Drive file list failed.");
  }
  const body = await response.json() as { files?: GoogleDriveFile[] };
  return { ...status, files: body.files || [], folderId };
}

export async function disconnectGoogleDrive() {
  await prisma.storageConnection.deleteMany({ where: { provider: STORAGE_PROVIDER } });
  await quarantineLegacyToken();
}

export async function createGoogleDriveUploadSession(input: { fileName: string; fileSize: number; contentType?: string; parentId?: string; preserveName?: boolean }) {
  const status = await googleDriveStatus();
  if (!status.configured) throw new Error(`Google Drive is not configured. Missing: ${status.missing.join(", ")}.`);
  const stored = await readStore();
  if (!stored) throw new Error("Connect Google Drive before uploading.");
  const tokens = await refreshAccessToken(stored);
  const folder = status.folder;
  // Uploads target either an explicit course subfolder (parentId) or the root content folder.
  const rootId = await ensureDriveFolder(tokens.accessToken || "", folder);
  const folderId = input.parentId || rootId;
  // Auto-sequence: prefix the file name with the next slot number in its target folder.
  const fileName = input.preserveName
    ? input.fileName
    : await nextSequencedName(tokens.accessToken || "", folderId, input.fileName, input.contentType);
  const metadata = { name: fileName, mimeType: input.contentType || "application/octet-stream", parents: [folderId] };
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": input.contentType || "application/octet-stream",
      "X-Upload-Content-Length": String(input.fileSize),
    },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || "Google Drive did not create an upload session.");
  }
  const uploadUrl = response.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive did not return an upload URL.");
  return { provider: "google-drive", uploadUrl, fileName, folder, contentType: input.contentType || "application/octet-stream" };
}

// ---------------------------------------------------------------------------
// File-manager operations — Drive is the source of truth for courses & videos.
// A "course" is a subfolder of the root content folder; its videos are the
// files inside, ordered by a leading "NN · " sequence prefix.
// ---------------------------------------------------------------------------

const SEQUENCE_RE = /^(\d{2,3})\s*[·.\-–]\s*/;
const VIDEO_MIME_RE = /^video\//;

async function driveAccessToken() {
  const stored = await readStore();
  if (!stored) throw new Error("Connect Google Drive before managing content.");
  const tokens = await refreshAccessToken(stored);
  if (!tokens.accessToken) throw new Error("Google Drive access token is unavailable.");
  return tokens.accessToken;
}

async function driveFetch(url: string, init: RequestInit, accessToken: string) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

export async function rootContentFolderId() {
  const token = await driveAccessToken();
  return ensureDriveFolder(token, driveFolderName());
}

// Determine the next sequence prefix for a new file dropped into a folder.
async function nextSequencedName(accessToken: string, folderId: string, fileName: string, contentType?: string) {
  // Only sequence media inside course subfolders, not the root vault.
  const rootId = await ensureDriveFolder(accessToken, driveFolderName());
  if (folderId === rootId) return fileName;
  if (contentType && !VIDEO_MIME_RE.test(contentType)) return fileName;

  const params = new URLSearchParams({
    q: `'${driveQueryValue(folderId)}' in parents and trashed=false`,
    spaces: "drive",
    fields: "files(name)",
    pageSize: "200",
  });
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, {}, accessToken);
  const body = await response.json() as { files?: Array<{ name: string }> };
  let max = 0;
  for (const f of body.files || []) {
    const match = SEQUENCE_RE.exec(f.name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const clean = fileName.replace(SEQUENCE_RE, "");
  const next = String(max + 1).padStart(2, "0");
  return `${next} · ${clean}`;
}

export async function listDriveFolders() {
  const token = await driveAccessToken();
  const rootId = await ensureDriveFolder(token, driveFolderName());
  const params = new URLSearchParams({
    q: `'${driveQueryValue(rootId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: "drive",
    orderBy: "name",
    fields: "files(id,name,modifiedTime)",
    pageSize: "200",
  });
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, {}, token);
  const body = await response.json() as { files?: Array<{ id: string; name: string; modifiedTime?: string }> };
  return { rootId, folders: body.files || [] };
}

// List a folder's contents (files + subfolders), sequence-sorted.
export async function listDriveFolderContents(folderId?: string) {
  const token = await driveAccessToken();
  const rootId = await ensureDriveFolder(token, driveFolderName());
  const target = folderId || rootId;
  const params = new URLSearchParams({
    q: `'${driveQueryValue(target)}' in parents and trashed=false`,
    spaces: "drive",
    orderBy: "name",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,videoMediaMetadata)",
    pageSize: "500",
  });
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, {}, token);
  const body = await response.json() as { files?: DriveEntry[] };
  const files = (body.files || []).sort((a, b) => sequenceOf(a.name) - sequenceOf(b.name) || a.name.localeCompare(b.name));
  return { rootId, folderId: target, files };
}

function sequenceOf(name: string) {
  const match = SEQUENCE_RE.exec(name);
  return match ? Number(match[1]) : 9999;
}

export type DriveEntry = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number };
};

export async function createDriveFolder(name: string, parentId?: string) {
  const token = await driveAccessToken();
  const parent = parentId || (await ensureDriveFolder(token, driveFolderName()));
  const response = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
  }, token);
  return response.json() as Promise<{ id: string; name: string }>;
}

export async function renameDriveItem(fileId: string, name: string) {
  const token = await driveAccessToken();
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name&supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }, token);
  return response.json() as Promise<{ id: string; name: string }>;
}

export async function deleteDriveItem(fileId: string) {
  const token = await driveAccessToken();
  // Trash rather than hard-delete so mistakes are recoverable from Drive.
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  }, token);
  return { ok: true };
}

// Move a file/folder into a target folder (or back to the content root when
// targetId is omitted). Detaches all current parents and attaches the target.
export async function moveDriveItem(fileId: string, targetId?: string) {
  const token = await driveAccessToken();
  const destination = targetId || (await ensureDriveFolder(token, driveFolderName()));
  const meta = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
    {},
    token,
  );
  const current = (await meta.json() as { parents?: string[] }).parents || [];
  if (current.length === 1 && current[0] === destination) return { id: fileId, moved: false };
  // Re-sequence the file for its new folder so it slots into order.
  const fileMeta = await getDriveFileMeta(fileId);
  const params = new URLSearchParams({
    addParents: destination,
    removeParents: current.join(","),
    fields: "id,name,parents",
    supportsAllDrives: "true",
  });
  const patch: { name?: string } = {};
  if ((fileMeta.mimeType || "").startsWith("video/")) {
    patch.name = await nextSequencedName(token, destination, fileMeta.name, fileMeta.mimeType);
  }
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) },
    token,
  );
  const result = await response.json() as { id: string; name: string };
  return { ...result, moved: true };
}

export async function getDriveFileMeta(fileId: string) {
  const token = await driveAccessToken();
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents&supportsAllDrives=true`,
    {},
    token,
  );
  return response.json() as Promise<{ id: string; name: string; mimeType?: string; size?: string; parents?: string[] }>;
}

// Stream a Drive file's bytes, forwarding an optional HTTP Range for video seeking.
export async function streamDriveFile(fileId: string, range?: string | null) {
  const token = await driveAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers.Range = range;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers },
  );
  if (!response.ok && response.status !== 206) {
    throw new Error(`Google Drive could not stream this file (${response.status}).`);
  }
  return response;
}
