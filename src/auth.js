// Verifies Supabase Auth access tokens sent as "Authorization: Bearer <jwt>" on /api/admin/* requests.
// Uses the project's public signing keys (JWKS), so the Worker holds no Supabase secret. Requires the
// project to use asymmetric JWT signing keys (Supabase dashboard → Project Settings → JWT Keys).

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;
const ALGORITHMS = {
  ES256: { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } },
  RS256: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
};
let jwksCache = { url: null, keys: null, fetchedAt: 0 };

/**
 * Returns { email } for a valid, unexpired Supabase access token belonging to an allowed admin, otherwise null.
 * Requires env.SUPABASE_URL (e.g. "https://abcd.supabase.co") and env.ADMIN_EMAILS.
 */
export async function verifyAdmin(request, env, fetchImpl = fetch) {
  const projectUrl = (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const admins = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!projectUrl || admins.length === 0) return null;

  const match = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "");
  if (!match) return null;
  const parts = match[1].split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header, payload;
  try {
    header = JSON.parse(base64UrlToText(encodedHeader));
    payload = JSON.parse(base64UrlToText(encodedPayload));
  } catch {
    return null;
  }
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm || typeof header.kid !== "string") return null;

  let jwk;
  try {
    jwk = (await getSigningKeys(`${projectUrl}/auth/v1/.well-known/jwks.json`, fetchImpl)).find(
      (key) => key.kid === header.kid && (key.alg === undefined || key.alg === header.alg)
    );
  } catch (err) {
    console.error("Supabase JWKS fetch failed", err);
    return null;
  }
  if (!jwk) return null;

  let valid = false;
  try {
    const { kty, crv, x, y, n, e } = jwk;
    const key = await crypto.subtle.importKey("jwk", { kty, crv, x, y, n, e }, algorithm.import, false, ["verify"]);
    valid = await crypto.subtle.verify(
      algorithm.verify,
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `${projectUrl}/auth/v1`) return null;
  if (!audiences.includes("authenticated") || payload.role !== "authenticated") return null;
  if (typeof payload.exp !== "number" || payload.exp < now - CLOCK_SKEW_SECONDS) return null;

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!admins.includes(email)) return null;

  return { email };
}

async function getSigningKeys(url, fetchImpl) {
  if (jwksCache.url === url && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  const { keys } = await response.json();
  if (!Array.isArray(keys)) throw new Error("jwks response has no keys");
  jwksCache = { url, keys, fetchedAt: Date.now() };
  return keys;
}

// Exposed for tests
export function resetAuthCache() {
  jwksCache = { url: null, keys: null, fetchedAt: 0 };
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function base64UrlToText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}
