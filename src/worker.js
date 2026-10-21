// vusolutions.net Worker. Static pages are served from assets; this script only runs for the paths in
// wrangler.jsonc `run_worker_first`: /api/* and the resume PDF.
import { EmailMessage } from "cloudflare:email";
import { verifyAdmin } from "./auth.js";
import { RESUME_PATH, handleResumeAdmin, serveResume } from "./resume.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "contact";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === RESUME_PATH && (request.method === "GET" || request.method === "HEAD")) {
      return serveResume(request, env);
    }

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "POST" });
      }
      return handleContact(request, env, ctx);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const identity = await verifyAdmin(request, env);
      if (!identity) return json({ ok: false, error: "Unauthorized." }, 401);
      // Bearer tokens already defeat CSRF; this also rejects any cross-site write outright
      if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) {
        return json({ ok: false, error: "Cross-origin request rejected." }, 403);
      }
      return handleResumeAdmin(request, env, identity);
    }

    if (url.pathname === RESUME_PATH) {
      return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "GET, HEAD" });
    }

    return json({ ok: false, error: "Not found." }, 404);
  },
};

async function handleContact(request, env, ctx) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Invalid form submission." }, 400);
  }

  const input = {
    name: field(form, "name"),
    email: field(form, "email"),
    phone: field(form, "phone"),
    message: field(form, "message"),
  };

  const errors = validate(input);
  if (Object.keys(errors).length > 0) {
    return json({ ok: false, error: "Please fix the highlighted fields.", errors }, 400);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") ?? "";
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), clientIp, env))) {
    return json({ ok: false, error: "Verification failed. Please try again." }, 403);
  }

  const country = request.cf?.country ?? null;
  const userAgent = (request.headers.get("User-Agent") ?? "").slice(0, 500);

  const { meta } = await env.DB.prepare(
    `INSERT INTO contact_submissions (name, email, phone, message, country, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(input.name, input.email, input.phone || null, input.message, country, userAgent)
    .run();

  // The submission is already saved, so a failed alert email must not fail the request
  ctx.waitUntil(notify(env, meta.last_row_id, input, country));

  return json({ ok: true });
}

function field(form, name) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validate({ name, email, phone, message }) {
  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = "Please enter your name (2–100 characters).";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = "Please enter a valid email address.";
  if (phone.length > 30 || (phone && !/^[+\d\s().-]+$/.test(phone))) errors.phone = "Please enter a valid phone number.";
  if (message.length < 10 || message.length > 5000) errors.message = "Please write a message (10–5,000 characters).";
  return errors;
}

async function verifyTurnstile(token, clientIp, env) {
  const expectedHostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );

  if (typeof token !== "string" || token.length === 0 || token.length > 2048 || expectedHostnames.size === 0) {
    return false;
  }

  let result;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: clientIp }),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    result = await response.json();
  } catch (err) {
    console.error("Turnstile siteverify failed", err);
    return false; // fail closed
  }

  return result.success === true && result.action === TURNSTILE_ACTION && expectedHostnames.has(result.hostname);
}

async function notify(env, id, { name, email, phone, message }, country) {
  const subject = `New contact form message from ${name}`;
  const body = [
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Phone:   ${phone || "-"}`,
    `Country: ${country || "-"}`,
    "",
    message,
    "",
    `-- Submission #${id} via vusolutions.net. Reply to this email to answer ${name} directly.`,
  ].join("\r\n");

  try {
    const mime = buildMime({ from: env.CONTACT_FROM, to: env.CONTACT_TO, replyTo: email, subject, body });
    await env.EMAIL.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, mime));
    await env.DB.prepare("UPDATE contact_submissions SET email_sent = 1 WHERE id = ?").bind(id).run();
  } catch (err) {
    console.error("Contact notification email failed", { id, error: String(err) });
  }
}

// Minimal RFC 5322 message: UTF-8 subject (RFC 2047) and a base64 plain-text body
function buildMime({ from, to, replyTo, subject, body }) {
  const domain = from.split("@")[1];
  const headers = [
    `From: "VU Solutions website" <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${replyTo.replace(/[\r\n<>]/g, "")}>`,
    `Subject: =?UTF-8?B?${base64(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const encodedBody = base64(body).replace(/.{1,76}/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${encodedBody}`;
}

function base64(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
