import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyAdmin, resetAuthCache } from "../src/auth.js";

const PROJECT = "https://abcd1234.supabase.co";
const env = { SUPABASE_URL: PROJECT, ADMIN_EMAILS: "vohoanvu96@gmail.com" };

const ec = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const rsa = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const jwks = {
  keys: [
    { ...(await crypto.subtle.exportKey("jwk", ec.publicKey)), kid: "ec-1", alg: "ES256", use: "sig" },
    { ...(await crypto.subtle.exportKey("jwk", rsa.publicKey)), kid: "rsa-1", alg: "RS256", use: "sig" },
  ],
};
const fakeFetch = async (url) => {
  assert.equal(url, `${PROJECT}/auth/v1/.well-known/jwks.json`);
  return Response.json(jwks);
};

const b64url = (data) => Buffer.from(typeof data === "string" ? data : new Uint8Array(data)).toString("base64url");

async function sign(payload, { alg = "ES256", kid = alg === "ES256" ? "ec-1" : "rsa-1", key } = {}) {
  const head = b64url(JSON.stringify({ alg, kid, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${head}.${body}`);
  const signature =
    alg === "ES256"
      ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key ?? ec.privateKey, data)
      : await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key ?? rsa.privateKey, data);
  return `${head}.${body}.${b64url(signature)}`;
}

const now = () => Math.floor(Date.now() / 1000);
const claims = () => ({
  iss: `${PROJECT}/auth/v1`,
  aud: "authenticated",
  role: "authenticated",
  email: "VoHoanVu96@gmail.com",
  sub: "user-id",
  exp: now() + 3600,
  iat: now(),
});
const requestWith = (token) =>
  new Request("https://vusolutions.net/api/admin/resume", token ? { headers: { Authorization: `Bearer ${token}` } } : {});

beforeEach(() => resetAuthCache());

test("accepts ES256 and RS256 tokens for the admin (email is case-insensitive)", async () => {
  assert.deepEqual(await verifyAdmin(requestWith(await sign(claims())), env, fakeFetch), { email: "vohoanvu96@gmail.com" });
  assert.deepEqual(await verifyAdmin(requestWith(await sign(claims(), { alg: "RS256" })), env, fakeFetch), { email: "vohoanvu96@gmail.com" });
});

test("rejects missing or malformed Authorization headers", async () => {
  assert.equal(await verifyAdmin(requestWith(null), env, fakeFetch), null);
  assert.equal(await verifyAdmin(requestWith("not-a-jwt"), env, fakeFetch), null);
});

test("fails closed when not configured", async () => {
  const token = await sign(claims());
  assert.equal(await verifyAdmin(requestWith(token), { ...env, SUPABASE_URL: "" }, fakeFetch), null);
  assert.equal(await verifyAdmin(requestWith(token), { ...env, ADMIN_EMAILS: "" }, fakeFetch), null);
});

test("rejects wrong issuer, audience, role, expired tokens and non-admin users", async () => {
  for (const bad of [
    { ...claims(), iss: "https://evil.supabase.co/auth/v1" },
    { ...claims(), aud: "anon" },
    { ...claims(), role: "anon" },
    { ...claims(), exp: now() - 3600 },
    { ...claims(), email: "someone@example.com" },
  ]) {
    assert.equal(await verifyAdmin(requestWith(await sign(bad)), env, fakeFetch), null, JSON.stringify(bad));
  }
});

test("rejects foreign keys, unknown kids, HS256 and alg/kid mismatches", async () => {
  const other = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  assert.equal(await verifyAdmin(requestWith(await sign(claims(), { key: other.privateKey })), env, fakeFetch), null);
  assert.equal(await verifyAdmin(requestWith(await sign(claims(), { kid: "nope" })), env, fakeFetch), null);
  assert.equal(await verifyAdmin(requestWith(await sign(claims(), { alg: "RS256", kid: "ec-1" })), env, fakeFetch), null);
  const head = b64url(JSON.stringify({ alg: "HS256", kid: "ec-1" }));
  assert.equal(await verifyAdmin(requestWith(`${head}.${b64url(JSON.stringify(claims()))}.c2ln`), env, fakeFetch), null);
});

test("rejects a tampered payload", async () => {
  const [head, , sig] = (await sign({ ...claims(), email: "someone@example.com" })).split(".");
  const forged = b64url(JSON.stringify(claims()));
  assert.equal(await verifyAdmin(requestWith(`${head}.${forged}.${sig}`), env, fakeFetch), null);
});

test("fails closed when the JWKS endpoint is down", async () => {
  const down = async () => new Response("nope", { status: 503 });
  assert.equal(await verifyAdmin(requestWith(await sign(claims())), env, down), null);
});
