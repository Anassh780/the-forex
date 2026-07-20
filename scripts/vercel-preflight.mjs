const integrations = {
  database: [["TURSO_DATABASE_URL", "DATABASE_URL"], "TURSO_AUTH_TOKEN"],
  authentication: [["NEXTAUTH_SECRET", "AUTH_SECRET"], "NEXTAUTH_URL"],
  googleDrive: [["GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID"], ["GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_SECRET"], "GOOGLE_ADMIN_EMAILS"],
  firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_STORAGE_BUCKET"],
  stripe: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
};

const placeholderPatterns = [/^your-/i, /^replace-with/i, /\.\.\./];
const isSet = (variable) => {
  const value = process.env[variable]?.trim();
  return Boolean(value && !placeholderPatterns.some((pattern) => pattern.test(value)));
};
const isRemoteDatabaseUrl = (value) => value?.startsWith("libsql://") || value?.startsWith("https://");
const hasVariable = (variable) => Array.isArray(variable) ? variable.some(isSet) : isSet(variable);
const missingName = (variable) => Array.isArray(variable) ? variable.join(" or ") : variable;

if (process.env.VERCEL) {
  const incomplete = Object.entries(integrations)
    .map(([name, variables]) => ({ name, missing: variables.filter((variable) => !hasVariable(variable)).map(missingName) }))
    .filter((integration) => integration.missing.length);

  for (const integration of incomplete) {
    console.warn(`[Vercel setup] ${integration.name} is disabled until these variables are added: ${integration.missing.join(", ")}`);
  }

  const databaseUrl = process.env.TURSO_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (databaseUrl && !isRemoteDatabaseUrl(databaseUrl)) {
    console.warn("[Vercel setup] Production database URL must be remote libsql:// or https://. Remove DATABASE_URL=file:./dev.db from Vercel and set TURSO_DATABASE_URL.");
  }

  console.log(incomplete.length
    ? "Vercel build continuing with graceful fallbacks for unconfigured integrations."
    : "Vercel preflight passed: database, authentication, storage, Drive, and checkout are configured.");
}
