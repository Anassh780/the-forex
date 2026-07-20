const PLACEHOLDER_PATTERNS = [/^your-/i, /^replace-with/i, /\.\.\./];

export function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value && !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value))) return value;
  }
  return undefined;
}

export function requiredEnv(...names: string[]) {
  const value = envValue(...names);
  if (!value) throw new Error(`${names.join(" or ")} is required.`);
  return value;
}

export function authSecret() {
  return requiredEnv("NEXTAUTH_SECRET", "AUTH_SECRET");
}

export function missingEnv(groups: Array<string | string[]>) {
  return groups
    .filter(group => Array.isArray(group) ? !envValue(...group) : !envValue(group))
    .map(group => Array.isArray(group) ? group.join(" or ") : group);
}
