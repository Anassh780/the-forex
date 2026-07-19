function emailList(value: string | undefined) {
  return (value || "")
    .split(/[;,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function platformOwnerEmails() {
  const explicit = emailList(process.env.PLATFORM_OWNER_EMAILS || process.env.PLATFORM_OWNER_EMAIL);
  if (explicit.length > 0) return explicit;

  // Backwards-compatible default: the first configured Google administrator is
  // treated as the main owner until PLATFORM_OWNER_EMAILS is set explicitly.
  return emailList(process.env.GOOGLE_ADMIN_EMAILS).slice(0, 1);
}

export function isPlatformOwnerEmail(email: string | null | undefined) {
  if (!email) return false;
  return platformOwnerEmails().includes(email.trim().toLowerCase());
}
