# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal/business portfolio site for VU Solutions (Vo Hoan Vu) at https://vusolutions.net. Pages are authored as an ASP.NET Core 10 Razor Pages app, but production has **no .NET runtime**: the Razor pages are prerendered to static HTML at build time and served by a Cloudflare Worker (`vusolutions`, Workers Free plan). The Worker script (`src/worker.js`) only handles `/api/*`, currently the contact form. Single project, no test project.

## Commands

.NET SDK is pinned to 10.0.403 (latest patch roll-forward) via `global.json`; Node 22+ is required by Wrangler (`.nvmrc`).

```bash
dotnet run --launch-profile https     # Razor dev server: https://localhost:7037 (no /api, no Worker)
dotnet watch run                      # hot reload while editing .cshtml/.css

npm ci
npm run build      # scripts/prerender.mjs -> dist/ (publishes, runs the app on :5199, saves pages, copies wwwroot)
npm run preview    # wrangler dev: dist/ + the Worker + local D1, like production. Restart it after a rebuild.
npm run deploy     # wrangler deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN/ACCOUNT_ID)
npx wrangler deploy --dry-run

# D1 (contact submissions). Migrations live in d1-migrations/
npx wrangler d1 migrations apply vusolutions-db --local
npx wrangler d1 migrations apply vusolutions-db --remote   # run manually before deploying a new migration; CI does not
npx wrangler d1 execute vusolutions-db --remote --command "SELECT * FROM contact_submissions ORDER BY id DESC"
```

There are no tests or linters configured.

## Deployment

- `.github/workflows/deploy-cloudflare.yml` runs `npm run build` then `npm run deploy` on every push to `main`, using repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Pushing to `main` is a production deploy.
- `wrangler.jsonc`: custom domains `vusolutions.net` and `www.vusolutions.net`; assets from `dist/` with `drop-trailing-slash` and `dist/404.html` (from `Pages/NotFound.cshtml`) for unknown paths; `run_worker_first: ["/api/*"]` so the script never runs for page requests. `cloudflare/_headers` sets cache headers and is copied into `dist/`.
- **Adding a public page requires adding it to the `pages` list in `scripts/prerender.mjs`** (path -> output file, e.g. `/Home/Portfolio` -> `Home/Portfolio.html`) and to `wwwroot/sitemap.xml`. Anything not in that list is not deployed. Asset paths on Cloudflare are case-sensitive, unlike ASP.NET routing.
- Only GET-rendered markup survives prerendering. Razor `OnPost` handlers and antiforgery do not run in production; server-side behaviour goes in `src/worker.js`. `Pages/Home/Contact.cshtml` and `About.cshtml` are legacy, unlinked and not prerendered.
- On .NET 10 the built-in `ScriptTagHelper` processes every `<script>` and HTML-encodes its attributes (`ld+json` becomes `ld&#x2B;json`). Use `<!script>...</!script>` to opt a tag out, as the JSON-LD block in `Index.cshtml` does. `<CompressionEnabled>false</CompressionEnabled>` in the csproj stops publish from writing `.gz`/`.br` copies of every static file into `dist/`.

## Contact form (`POST /api/contact`)

Flow in `src/worker.js`: validate fields → Turnstile siteverify → insert into D1 `contact_submissions` → `ctx.waitUntil` email alert (sets `email_sent = 1` on success; a failed email never fails the request).

- **Turnstile** widget `vusolutions-contact` (managed). Site key is public, in `appsettings.json` → `Turnstile:SiteKey`, read by `Index.cshtml` at prerender. Secret is the Worker secret `TURNSTILE_SECRET` (never in files). Siteverify must return `success`, action `contact`, and a hostname in the `TURNSTILE_HOSTNAMES` var. The widget is rendered explicitly and reset after every submit (tokens are single-use).
- Locally, `.dev.vars` (gitignored) holds Cloudflare's public always-pass *test* secret, which returns hostname `example.com` and no action, so real local submissions get 403 by design. Test the happy path against production.
- **Email** uses Email Routing's `send_email` binding (`EmailMessage` from `cloudflare:email` with a hand-built MIME message), not Email Sending: Email Sending is unavailable on Workers Free, while sending to a verified destination address is free. The binding is locked to `vohoanvu96@gmail.com`; the sender `contact@vusolutions.net` requires Email Routing to stay enabled on the zone. `Reply-To` is the submitter.

## Resume admin (`/admin/resume`, `/api/admin/*`)

- The resume at `/files/Vu-Resume-Latest.pdf` is served by the Worker from KV (`RESUME` binding, `src/resume.js`): `resume:current` plus the last 5 replaced versions under `resume:history:<uploadedAt>`. If KV is empty it falls back to the PDF bundled in `wwwroot/files`. That path is in `run_worker_first`; keep it there or uploads stop showing.
- Auth is **Supabase Auth** on the dedicated `vusolutions-admin` project (`SUPABASE_URL` var; URL and publishable key also in `appsettings.json` → `Supabase`, both public). The admin page calls the Supabase Auth REST API directly (password grant, no SDK) and keeps the session in `sessionStorage`. `src/auth.js` verifies the Bearer JWT against the project's JWKS (ES256/RS256 only, never HS256), checks issuer, `aud`/`role` = `authenticated`, expiry, and the `ADMIN_EMAILS` allowlist. It fails closed when unconfigured. Don't point it at the CodeJitsu-Prod Supabase project.
- `npm test` (Node's built-in runner, `test/*.test.mjs`) covers `auth.js` and `resume.js` with a fake KV and locally generated keys; CI runs it before deploying.

## Design system

The site follows the CodeJitsu "Zen Samurai" design system (source: `D:\vu-repos\bjj-training\MartialArtTrainingAssistant\DESIGN_SYSTEM.md`), ported from Tailwind to plain CSS in `wwwroot/css/site.css`:

- All colors, spacing, radii, shadows and motion are CSS custom properties in `:root` (parchment / slate / samurai / blood / ink / gold ramps plus semantic aliases). Components use tokens only; no inline `style=` for token values (use the `u-*` utilities).
- Fonts: Cinzel (labels, eyebrows, nav, badges: always uppercase), Noto Serif (headings, narrative), Noto Sans (body, UI, data). Loaded from Google Fonts in `_Layout.cshtml`.
- Icons: Lucide only, rendered server-side as inline SVG via `Icons.Svg("name", size)` (`Infrastructure/Icons.cs`, path data from lucide-static 0.460.0). Add new icons there from the same package version; don't hand-draw paths.
- Patterns: dark hero (`.hero`, `.hero--compact`) for page tops, light parchment sections (`.section`, `.section--surface`), `.card`, `.scroll-card` (RationaleCard), `.zen-table`, `.kv-panel`, `.steps`, `.stats`, `.timeline`, `.badge--*`, `.btn--{primary,dark,cta,secondary,ghost,ghost-dark}`. The blood-red `.btn--cta` is for the main call to action only.
- Bootstrap and jQuery are no longer loaded by the layout (still vendored in `wwwroot/lib`, unused).

## Architecture (legacy .NET parts)

- **Layout/SEO** in `Pages/Shared/_Layout.cshtml`: pages set `ViewData["Title"]` and `ViewData["Description"]`; the canonical/OG URL is built from `Context.Request.Path` (correct after prerendering because the script requests each real path). `wwwroot/sitemap.xml`, `robots.txt` and the JSON-LD in `Index.cshtml` are maintained by hand.
- There is no database, Identity or EF Core; they were removed. Don't add a NuGet package that ships static web assets (e.g. `Microsoft.AspNetCore.Identity.UI`) without checking `dist/`: its files get published under `wwwroot/` and deployed publicly.

## Repo quirks

- `obj/Debug/...` files and `wwwroot/lib/` are tracked in git even though `.gitignore` lists them; builds modify the tracked `obj` files. Avoid committing those incidental changes.
- `VuSolutionsWeb.csproj` excludes `node_modules`, `dist`, `.build`, `.wrangler`, `src`, `d1-migrations` and `package*.json` from the Web SDK's default items; keep that, or Node/Worker files get swept into the .NET publish output.
- `wwwroot/files/Vu-Resume-Latest.pdf` is public and currently includes the references' personal phone numbers and emails.
