const required = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_DRIVE_REDIRECT_URI",
  "GOOGLE_ADMIN_EMAILS",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

if (process.env.VERCEL) {
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Vercel deployment is missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!process.env.TURSO_DATABASE_URL.startsWith("libsql://") && !process.env.TURSO_DATABASE_URL.startsWith("https://")) {
    console.error("TURSO_DATABASE_URL must be a remote libsql:// or https:// URL, not a local file.");
    process.exit(1);
  }
  console.log("Vercel preflight passed: database, authentication, storage, Drive, and checkout variables are present.");
}
