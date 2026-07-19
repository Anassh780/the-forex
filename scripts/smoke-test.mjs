const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
let failures = 0;

async function check(path, expected, opts = {}) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", ...opts });
  const location = res.headers.get("location");
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  const preview = body.slice(0, 120).replace(/\s+/g, " ");
  const accepted = Array.isArray(expected) ? expected : [expected];
  const passed = accepted.includes(res.status);
  if (!passed) failures += 1;
  console.log(JSON.stringify({ path, status: res.status, expected: accepted, passed, location, preview }));
  return res;
}

await check("/", 200);
await check("/login", 200);
await check("/signup", 200);
await check("/vip", 200);
await check("/strategies", 200);
await check("/api/strategies", 200);
await check("/dashboard", 307);
await check("/feedback", 307);
await check("/support", 307);
await check("/profile", 307);
await check("/api/feedback", 401);
await check("/api/profile", 401, { method: "PUT" });
await check("/courses", 307);
await check("/admin", 307);
await check("/admin-ui", 307);
await check("/courses/market-structure", 307);
await check("/strategies/the-order-block", 200);
await check("/api/strategies/by-slug/the-order-block", 200);
await check("/api/register", [201, 409], {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "smoke@example.com", password: "password123" }),
});

if (failures > 0) {
  throw new Error(`${failures} smoke test${failures === 1 ? "" : "s"} failed.`);
}

console.log(`Smoke tests passed against ${base}.`);
