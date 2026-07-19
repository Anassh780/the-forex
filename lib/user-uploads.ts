import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { extname, join, resolve } from "path";
import { firebaseUserStorageConfigured, readFirebaseUserFile, removeFirebaseUserFile, saveFirebaseUserFile } from "@/lib/firebase-storage";

export type UserUploadKind = "profiles" | "feedback" | "support";

const UPLOAD_ROOT = resolve(process.cwd(), ".data", "user-uploads");
const PROFILE_MAX_BYTES = 3 * 1024 * 1024;
const FEEDBACK_MAX_BYTES = 4 * 1024 * 1024;
const SAFE_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);
const SAFE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".mov", ".webm",
  ".pdf", ".txt", ".csv", ".json", ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
]);

export type StoredUserFile = {
  name: string;
  url: string;
  type: string;
  size: number;
};

function safeExtension(file: File) {
  const extension = extname(file.name).toLowerCase();
  return SAFE_EXTENSIONS.has(extension) ? extension : "";
}

function validateUpload(file: File, kind: UserUploadKind) {
  const maxBytes = kind === "profiles" ? PROFILE_MAX_BYTES : FEEDBACK_MAX_BYTES;
  if (!file.size) throw new Error("Empty files cannot be uploaded.");
  if (file.size > maxBytes) throw new Error(`${file.name} is larger than ${maxBytes / 1024 / 1024} MB.`);

  const extension = safeExtension(file);
  const isRasterImage = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension);
  if (kind === "profiles" && !isRasterImage) throw new Error("Profile pictures must be JPG, PNG, GIF, or WebP images.");

  const isFeedbackType = isRasterImage || file.type.startsWith("audio/") || file.type.startsWith("video/") || SAFE_DOCUMENT_TYPES.has(file.type) || SAFE_EXTENSIONS.has(extension);
  if ((kind === "feedback" || kind === "support") && !isFeedbackType) throw new Error(`${file.name} is not a supported image, audio, video, or document format.`);
  return extension || (isRasterImage ? ".jpg" : "");
}

export async function saveUserFile(file: File, kind: UserUploadKind, userId: string): Promise<StoredUserFile> {
  const extension = validateUpload(file, kind);
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  const fileName = `${safeUserId}-${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (firebaseUserStorageConfigured()) {
    await saveFirebaseUserFile(`user-content/${kind}/${fileName}`, bytes, file.type || contentTypeForFile(fileName));
  } else {
    if (process.env.VERCEL) throw new Error("Firebase Storage credentials are required for persistent Vercel uploads.");
    const directory = join(UPLOAD_ROOT, kind);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), bytes);
  }
  return {
    name: file.name.slice(0, 180),
    url: `/api/media/${kind}/${fileName}`,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function removeUserFile(url?: string | null) {
  const match = /^\/api\/media\/(profiles|feedback|support)\/([a-zA-Z0-9_.-]+)$/.exec(url || "");
  if (!match) return;
  if (firebaseUserStorageConfigured()) {
    await removeFirebaseUserFile(`user-content/${match[1]}/${match[2]}`).catch(() => undefined);
  } else {
    await unlink(join(UPLOAD_ROOT, match[1], match[2])).catch(() => undefined);
  }
}

export async function readUserFile(kind: string, fileName: string) {
  if (kind !== "profiles" && kind !== "feedback" && kind !== "support") return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) return null;
  const path = join(UPLOAD_ROOT, kind, fileName);
  if (!path.startsWith(join(UPLOAD_ROOT, kind))) return null;
  try {
    if (firebaseUserStorageConfigured()) return await readFirebaseUserFile(`user-content/${kind}/${fileName}`);
    return { bytes: await readFile(path), contentType: contentTypeForFile(fileName) };
  } catch {
    return null;
  }
}

function contentTypeForFile(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
    ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".zip": "application/zip",
    ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return types[extension] || "application/octet-stream";
}
