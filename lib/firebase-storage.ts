import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

type FirebaseUploadInput = {
  fileName: string;
  fileSize: number;
  contentType?: string;
};

const REQUIRED = ["FIREBASE_STORAGE_BUCKET"];

function cleanFileName(fileName: string) {
  const cleaned = fileName.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(0, 120);
  return cleaned || "upload.bin";
}

function configuredCredential() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as FirebaseServiceAccount;
    return cert({
      projectId: serviceAccount.project_id || serviceAccount.projectId,
      clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
      privateKey: serviceAccount.private_key || serviceAccount.privateKey,
    });
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  return applicationDefault();
}

export function getFirebaseStorageStatus() {
  const missing = REQUIRED.filter(name => !process.env[name]);
  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasCredentialFile = Boolean(credentialPath && existsSync(credentialPath));
  const hasInlineCredential = Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

  if (!hasCredentialFile && !hasInlineCredential) missing.push("FIREBASE_SERVICE_ACCOUNT_PATH");

  return {
    configured: missing.length === 0,
    missing,
    bucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    folder: process.env.FIREBASE_STORAGE_FOLDER || "EdgeLedger Content",
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 20480),
  };
}

function bucket() {
  const status = getFirebaseStorageStatus();
  if (!status.configured || !process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error(`Firebase Storage is not configured. Missing: ${status.missing.join(", ")}.`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: configuredCredential(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return getStorage().bucket();
}

export function firebaseUserStorageConfigured() {
  return getFirebaseStorageStatus().configured;
}

export async function saveFirebaseUserFile(path: string, bytes: Buffer, contentType: string) {
  await bucket().file(path).save(bytes, {
    resumable: false,
    contentType,
    metadata: { cacheControl: "private, max-age=3600", contentDisposition: "inline" },
  });
}

export async function readFirebaseUserFile(path: string) {
  const file = bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { bytes, contentType: metadata.contentType || "application/octet-stream" };
}

export async function removeFirebaseUserFile(path: string) {
  await bucket().file(path).delete({ ignoreNotFound: true });
}

export async function createFirebaseUploadSession(input: FirebaseUploadInput) {
  const status = getFirebaseStorageStatus();
  const maxBytes = status.maxUploadMb * 1024 * 1024;
  if (input.fileSize > maxBytes) throw new Error(`This file is larger than the ${status.maxUploadMb} MB upload limit.`);

  const safeName = cleanFileName(input.fileName);
  const folder = status.folder.replace(/^\/+|\/+$/g, "") || "EdgeLedger Content";
  const destination = `${folder}/${Date.now()}-${randomUUID()}-${safeName}`;
  const contentType = input.contentType || "application/octet-stream";
  const file = bucket().file(destination);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });

  return {
    provider: "firebase",
    uploadUrl,
    method: "PUT",
    path: destination,
    fileName: safeName,
    folder,
    contentType,
  };
}
