// Resume PDF stored in Workers KV, so it can be replaced from /admin/resume without a redeploy.
// "resume:current" holds the live PDF; replaced versions move to "resume:history:<uploadedAt>".

export const RESUME_PATH = "/files/Vu-Resume-Latest.pdf";
export const CURRENT_KEY = "resume:current";
export const HISTORY_PREFIX = "resume:history:";
export const HISTORY_LIMIT = 5;
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

/** Serves the uploaded resume, falling back to the PDF bundled in the static assets. */
export async function serveResume(request, env) {
  const { value, metadata } = await env.RESUME.getWithMetadata(CURRENT_KEY, { type: "arrayBuffer" });
  if (!value || !metadata) return env.ASSETS.fetch(request);

  const etag = `"${metadata.sha256}"`;
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="Vu-Resume-Latest.pdf"',
    // Always revalidate so a new upload shows up as soon as KV has it
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: etag,
    "Last-Modified": new Date(metadata.uploadedAt).toUTCString(),
  };

  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : value, {
    headers: { ...headers, "Content-Length": String(value.byteLength) },
  });
}

/** Routes /api/admin/resume*. The caller must already have verified the admin identity. */
export async function handleResumeAdmin(request, env, identity) {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/admin/resume" && request.method === "GET") {
    return json({ ok: true, current: await currentMetadata(env), history: await listHistory(env) });
  }
  if (pathname === "/api/admin/resume" && request.method === "POST") {
    return uploadResume(request, env, identity);
  }
  if (pathname === "/api/admin/resume/restore" && request.method === "POST") {
    return restoreResume(request, env, identity);
  }
  return json({ ok: false, error: "Not found." }, 404);
}

async function uploadResume(request, env, identity) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Send the PDF as multipart form data in a field named \"file\"." }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") return json({ ok: false, error: "Choose a PDF file to upload." }, 400);
  if (file.size === 0) return json({ ok: false, error: "That file is empty." }, 400);
  if (file.size > MAX_RESUME_BYTES) return json({ ok: false, error: "The PDF must be 10 MB or smaller." }, 413);

  const bytes = await file.arrayBuffer();
  if (!isPdf(bytes)) return json({ ok: false, error: "That file isn't a PDF." }, 415);

  const metadata = {
    uploadedAt: new Date().toISOString(),
    uploadedBy: identity.email,
    filename: sanitizeFilename(file.name),
    size: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };

  await archiveCurrent(env);
  await env.RESUME.put(CURRENT_KEY, bytes, { metadata });
  await trimHistory(env);

  return json({ ok: true, current: metadata, history: await listHistory(env) });
}

async function restoreResume(request, env, identity) {
  let key;
  try {
    ({ key } = await request.json());
  } catch {
    return json({ ok: false, error: "Send JSON like {\"key\": \"resume:history:...\"}." }, 400);
  }
  if (typeof key !== "string" || !key.startsWith(HISTORY_PREFIX)) {
    return json({ ok: false, error: "Unknown version." }, 400);
  }

  const { value, metadata } = await env.RESUME.getWithMetadata(key, { type: "arrayBuffer" });
  if (!value || !metadata) return json({ ok: false, error: "That version no longer exists." }, 404);

  const restored = {
    ...metadata,
    uploadedAt: new Date().toISOString(),
    uploadedBy: identity.email,
    restoredFrom: metadata.uploadedAt,
  };

  await archiveCurrent(env);
  await env.RESUME.put(CURRENT_KEY, value, { metadata: restored });
  await trimHistory(env);

  return json({ ok: true, current: restored, history: await listHistory(env) });
}

async function archiveCurrent(env) {
  const { value, metadata } = await env.RESUME.getWithMetadata(CURRENT_KEY, { type: "arrayBuffer" });
  if (!value || !metadata) return;
  await env.RESUME.put(`${HISTORY_PREFIX}${metadata.uploadedAt}`, value, { metadata });
}

async function trimHistory(env) {
  const history = await listHistory(env);
  for (const old of history.slice(HISTORY_LIMIT)) {
    await env.RESUME.delete(old.key);
  }
}

async function currentMetadata(env) {
  const { metadata } = await env.RESUME.getWithMetadata(CURRENT_KEY, { type: "arrayBuffer" });
  return metadata ?? null;
}

async function listHistory(env) {
  const entries = [];
  let cursor;
  do {
    const page = await env.RESUME.list({ prefix: HISTORY_PREFIX, cursor });
    for (const { name, metadata } of page.keys) entries.push({ key: name, ...(metadata ?? {}) });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  // Keys embed ISO timestamps, so newest first is a reverse string sort
  return entries.sort((a, b) => (a.key < b.key ? 1 : -1));
}

function isPdf(bytes) {
  const head = new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength));
  return String.fromCharCode(...head) === "%PDF-";
}

function sanitizeFilename(name) {
  return (typeof name === "string" ? name : "resume.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 100) || "resume.pdf";
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
