export function uniqueBy<T>(items: readonly T[], keyOf: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
