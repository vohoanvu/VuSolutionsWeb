import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENT_KEY, HISTORY_LIMIT, RESUME_PATH, handleResumeAdmin, serveResume } from "../src/resume.js";

// Minimal in-memory stand-in for a Workers KV namespace
function fakeKv() {
  const store = new Map();
  return {
    store,
    async getWithMetadata(key) {
      const entry = store.get(key);
      return entry ? { value: entry.value.slice(0), metadata: entry.metadata } : { value: null, metadata: null };
    },
    async put(key, value, { metadata } = {}) {
      store.set(key, { value: value.slice(0), metadata });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix }) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: store.get(name).metadata }));
      return { keys, list_complete: true };
    },
  };
}

const identity = { email: "vohoanvu96@gmail.com" };
const pdf = (text) => new TextEncoder().encode(`%PDF-1.7\n${text}`).buffer;
const bundled = new Response("bundled-pdf", { headers: { "Content-Type": "application/pdf" } });

function makeEnv() {
  return { RESUME: fakeKv(), ASSETS: { fetch: async () => bundled.clone() } };
}

function upload(env, body, filename = "Vu-Resume.pdf") {
  const form = new FormData();
  form.set("file", new File([body], filename, { type: "application/pdf" }));
  return handleResumeAdmin(new Request("https://vusolutions.net/api/admin/resume", { method: "POST", body: form }), env, identity);
}

const get = (env, headers = {}) => serveResume(new Request(`https://vusolutions.net${RESUME_PATH}`, { headers }), env);

test("falls back to the bundled PDF until something is uploaded", async () => {
  const response = await get(makeEnv());
  assert.equal(await response.text(), "bundled-pdf");
});

test("upload replaces the live resume and serves it with an ETag", async () => {
  const env = makeEnv();
  const response = await upload(env, pdf("v1"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.current.uploadedBy, "vohoanvu96@gmail.com");
  assert.equal(body.current.size, pdf("v1").byteLength);
  assert.match(body.current.sha256, /^[0-9a-f]{64}$/);

  const served = await get(env);
  assert.equal(served.headers.get("Content-Type"), "application/pdf");
  assert.equal(served.headers.get("ETag"), `"${body.current.sha256}"`);
  assert.equal(new TextDecoder().decode(await served.arrayBuffer()), "%PDF-1.7\nv1");

  const notModified = await get(env, { "If-None-Match": `"${body.current.sha256}"` });
  assert.equal(notModified.status, 304);
});

test("rejects non-PDF, empty and missing files without touching the live resume", async () => {
  const env = makeEnv();
  await upload(env, pdf("good"));
  const before = env.RESUME.store.get(CURRENT_KEY).metadata.sha256;

  assert.equal((await upload(env, new TextEncoder().encode("<html>not a pdf</html>").buffer)).status, 415);
  assert.equal((await upload(env, new ArrayBuffer(0))).status, 400);
  const noFile = await handleResumeAdmin(
    new Request("https://vusolutions.net/api/admin/resume", { method: "POST", body: new FormData() }), env, identity);
  assert.equal(noFile.status, 400);

  assert.equal(env.RESUME.store.get(CURRENT_KEY).metadata.sha256, before);
});

test("keeps only the last few versions and can restore one", async () => {
  const env = makeEnv();
  for (let i = 1; i <= HISTORY_LIMIT + 3; i++) {
    await upload(env, pdf(`v${i}`));
    await new Promise((r) => setTimeout(r, 2)); // distinct uploadedAt timestamps
  }

  const list = await (await handleResumeAdmin(new Request("https://vusolutions.net/api/admin/resume"), env, identity)).json();
  assert.equal(list.history.length, HISTORY_LIMIT);
  assert.ok(list.history[0].uploadedAt > list.history[1].uploadedAt, "newest first");

  const oldest = list.history.at(-1);
  const restore = await handleResumeAdmin(
    new Request("https://vusolutions.net/api/admin/resume/restore", { method: "POST", body: JSON.stringify({ key: oldest.key }) }),
    env, identity);
  const restored = await restore.json();
  assert.equal(restore.status, 200);
  assert.equal(restored.current.restoredFrom, oldest.uploadedAt);
  assert.equal(restored.history.length, HISTORY_LIMIT);

  const served = new TextDecoder().decode(await (await get(env)).arrayBuffer());
  assert.equal(served, "%PDF-1.7\nv3");
});

test("restore refuses keys outside the history prefix", async () => {
  const env = makeEnv();
  const response = await handleResumeAdmin(
    new Request("https://vusolutions.net/api/admin/resume/restore", { method: "POST", body: JSON.stringify({ key: CURRENT_KEY }) }),
    env, identity);
  assert.equal(response.status, 400);
});
