const integrations = {
  database: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
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
const hasVariable = (variable) => Array.isArray(variable) ? variable.some(isSet) : isSet(variable);
const missingName = (variable) => Array.isArray(variable) ? variable.join(" or ") : variable;

if (process.env.VERCEL) {
  const incomplete = Object.entries(integrations)
    .map(([name, variables]) => ({ name, missing: variables.filter((variable) => !hasVariable(variable)).map(missingName) }))
    .filter((integration) => integration.missing.length);

  for (const integration of incomplete) {
    console.warn(`[Vercel setup] ${integration.name} is disabled until these variables are added: ${integration.missing.join(", ")}`);
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl && !tursoUrl.startsWith("libsql://") && !tursoUrl.startsWith("https://")) {
    console.warn("[Vercel setup] TURSO_DATABASE_URL is not a remote libsql:// or https:// URL; persistent database features will remain disabled.");
  }

  console.log(incomplete.length
    ? "Vercel build continuing with graceful fallbacks for unconfigured integrations."
    : "Vercel preflight passed: database, authentication, storage, Drive, and checkout are configured.");
}
