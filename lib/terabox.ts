import "server-only";
import { createHash } from "crypto";

type TeraBoxResult = {
  errno?: number;
  errmsg?: string;
  uploadid?: string;
  return_type?: number;
  fs_id?: number | string;
  server_filename?: string;
  path?: string;
  size?: number;
};

const CHUNK_SIZE = 8 * 1024 * 1024;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Storage is not configured: missing ${name}.`);
  return value;
}

function domain(name: string) {
  const value = required(name).replace(/\/$/, "");
  return value.startsWith("http") ? value : `https://${value}`;
}

async function readResult(response: Response): Promise<TeraBoxResult> {
  const text = await response.text();
  let result: TeraBoxResult;
  try { result = JSON.parse(text); } catch { throw new Error(`TeraBox returned an unreadable response (${response.status}).`); }
  if (!response.ok || (typeof result.errno === "number" && result.errno !== 0)) throw new Error(result.errmsg || `TeraBox upload failed with code ${result.errno ?? response.status}.`);
  return result;
}

function safeFilename(name: string) {
  const clean = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return clean.slice(0, 140) || `content-${Date.now()}`;
}

export async function uploadToTeraBox(file: File) {
  const accessToken = required("TERABOX_ACCESS_TOKEN");
  const clientId = required("TERABOX_CLIENT_ID");
  const apiDomain = domain("TERABOX_API_DOMAIN");
  const uploadDomain = domain("TERABOX_UPLOAD_DOMAIN");
  const appName = (process.env.TERABOX_APP_NAME || "EdgeLedger").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const bytes = Buffer.from(await file.arrayBuffer());
  const parts: Buffer[] = [];
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) parts.push(bytes.subarray(start, Math.min(start + CHUNK_SIZE, bytes.length)));
  const blockList = parts.map(part => createHash("md5").update(part).digest("hex"));
  const path = `/From: Other Applications/${appName}-${clientId}/${Date.now()}-${safeFilename(file.name)}`;

  const precreateBody = new URLSearchParams({ path, autoinit: "1", block_list: JSON.stringify(blockList) });
  const precreateUrl = `${apiDomain}/openapi/api/precreate?access_tokens=${encodeURIComponent(accessToken)}`;
  const precreate = await readResult(await fetch(precreateUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: precreateBody, cache: "no-store" }));
  if (!precreate.uploadid) throw new Error("TeraBox did not return an upload ID. Confirm the API and upload domains for this token.");

  for (let index = 0; index < parts.length; index++) {
    const query = new URLSearchParams({ method: "upload", app_id: "250528", path, uploadid: precreate.uploadid, partseq: String(index), access_tokens: accessToken });
    const form = new FormData();
    const payload = Uint8Array.from(parts[index]);
    form.append("file", new Blob([payload.buffer], { type: file.type || "application/octet-stream" }), file.name);
    await readResult(await fetch(`${uploadDomain}/rest/2.0/pcs/superfile2?${query}`, { method: "POST", body: form, cache: "no-store" }));
  }

  const createBody = new URLSearchParams({ path, size: String(file.size), uploadid: precreate.uploadid, block_list: JSON.stringify(blockList), rtype: "3" });
  const createUrl = `${apiDomain}/openapi/api/create?access_tokens=${encodeURIComponent(accessToken)}`;
  const created = await readResult(await fetch(createUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: createBody, cache: "no-store" }));
  return { id: created.fs_id, name: created.server_filename || file.name, path: created.path || path, size: created.size || file.size };
}
