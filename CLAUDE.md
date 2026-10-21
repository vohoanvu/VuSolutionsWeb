# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal/business portfolio site for VU Solutions (Vo Hoan Vu) at https://vusolutions.net. Pages are authored as an ASP.NET Core 8 Razor Pages app, but production has **no .NET runtime**: the Razor pages are prerendered to static HTML at build time and served by a Cloudflare Worker (`vusolutions`, Workers Free plan). The Worker script (`src/worker.js`) only handles `/api/*`, currently the contact form. Single project, no test project.

## Commands

.NET SDK is pinned to 8.0.404 via `global.json`; Node 22+ is required by Wrangler (`.nvmrc`).

```bash
dotnet run --launch-profile https     # Razor dev server: https://localhost:7037 (no /api, no Worker)
dotnet watch run                      # hot reload while editing .cshtml/.css

npm ci
npm run build      # scripts/prerender.mjs -> dist/ (publishes, runs the app on :5199, saves pages, copies wwwroot)
npm run preview    # wrangler dev: dist/ + the Worker + local D1, like production. Restart it after a rebuild.
npm run deploy     # wrangler deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN/ACCOUNT_ID)
npx wrangler deploy --dry-run

# D1 (contact submissions). Migrations live in d1-migrations/, NOT migrations/ (that is EF Core's folder)
npx wrangler d1 migrations apply vusolutions-db --local
npx wrangler d1 migrations apply vusolutions-db --remote   # run manually before deploying a new migration; CI does not
npx wrangler d1 execute vusolutions-db --remote --command "SELECT * FROM contact_submissions ORDER BY id DESC"

# EF Core migrations (PostgreSQL via Npgsql; local only, unused in production)
dotnet ef migrations add <Name>
```

There are no tests or linters configured.

## Deployment

- `.github/workflows/deploy-cloudflare.yml` runs `npm run build` then `npm run deploy` on every push to `main`, using repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Pushing to `main` is a production deploy.
- `wrangler.jsonc`: custom domains `vusolutions.net` and `www.vusolutions.net`; assets from `dist/` with `drop-trailing-slash` and `dist/404.html` (from `Pages/NotFound.cshtml`) for unknown paths; `run_worker_first: ["/api/*"]` so the script never runs for page requests. `cloudflare/_headers` sets cache headers and is copied into `dist/`.
- **Adding a public page requires adding it to the `pages` list in `scripts/prerender.mjs`** (path -> output file, e.g. `/Home/Portfolio` -> `Home/Portfolio.html`) and to `wwwroot/sitemap.xml`. Anything not in that list is not deployed. Asset paths on Cloudflare are case-sensitive, unlike ASP.NET routing.
- Only GET-rendered markup survives prerendering. Razor `OnPost` handlers, antiforgery, Identity and EF Core do not run in production; server-side behaviour goes in `src/worker.js`. `Pages/Home/Contact.cshtml` and `About.cshtml` are legacy, unlinked and not prerendered.

## Contact form (`POST /api/contact`)

Flow in `src/worker.js`: validate fields → Turnstile siteverify → insert into D1 `contact_submissions` → `ctx.waitUntil` email alert (sets `email_sent = 1` on success; a failed email never fails the request).

- **Turnstile** widget `vusolutions-contact` (managed). Site key is public, in `appsettings.json` → `Turnstile:SiteKey`, read by `Index.cshtml` at prerender. Secret is the Worker secret `TURNSTILE_SECRET` (never in files). Siteverify must return `success`, action `contact`, and a hostname in the `TURNSTILE_HOSTNAMES` var. The widget is rendered explicitly and reset after every submit (tokens are single-use).
- Locally, `.dev.vars` (gitignored) holds Cloudflare's public always-pass *test* secret, which returns hostname `example.com` and no action, so real local submissions get 403 by design. Test the happy path against production.
- **Email** uses Email Routing's `send_email` binding (`EmailMessage` from `cloudflare:email` with a hand-built MIME message), not Email Sending: Email Sending is unavailable on Workers Free, while sending to a verified destination address is free. The binding is locked to `vohoanvu96@gmail.com`; the sender `contact@vusolutions.net` requires Email Routing to stay enabled on the zone. `Reply-To` is the submitter.

## Design system

The site follows the CodeJitsu "Zen Samurai" design system (source: `D:\vu-repos\bjj-training\MartialArtTrainingAssistant\DESIGN_SYSTEM.md`), ported from Tailwind to plain CSS in `wwwroot/css/site.css`:

- All colors, spacing, radii, shadows and motion are CSS custom properties in `:root` (parchment / slate / samurai / blood / ink / gold ramps plus semantic aliases). Components use tokens only; no inline `style=` for token values (use the `u-*` utilities).
- Fonts: Cinzel (labels, eyebrows, nav, badges: always uppercase), Noto Serif (headings, narrative), Noto Sans (body, UI, data). Loaded from Google Fonts in `_Layout.cshtml`.
- Icons: Lucide only, rendered server-side as inline SVG via `Icons.Svg("name", size)` (`Infrastructure/Icons.cs`, path data from lucide-static 0.460.0). Add new icons there from the same package version; don't hand-draw paths.
- Patterns: dark hero (`.hero`, `.hero--compact`) for page tops, light parchment sections (`.section`, `.section--surface`), `.card`, `.scroll-card` (RationaleCard), `.zen-table`, `.kv-panel`, `.steps`, `.stats`, `.timeline`, `.badge--*`, `.btn--{primary,dark,cta,secondary,ghost,ghost-dark}`. The blood-red `.btn--cta` is for the main call to action only.
- Bootstrap and jQuery are no longer loaded by the layout (still vendored in `wwwroot/lib`, and the unused Identity pages still reference Bootstrap classes).

## Architecture (legacy .NET parts)

- **Layout/SEO** in `Pages/Shared/_Layout.cshtml`: pages set `ViewData["Title"]` and `ViewData["Description"]`; the canonical/OG URL is built from `Context.Request.Path` (correct after prerendering because the script requests each real path). `wwwroot/sitemap.xml`, `robots.txt` and the JSON-LD in `Index.cshtml` are maintained by hand.
- **Identity / EF Core** (`Program.cs`, `Areas/Identity`, `Data/`, `Models/`) are local-only leftovers. `ApplicationDbContext` declares an unused project/time-tracking domain; its fluent config is commented out. `ConnectionStrings:DefaultConnection` is empty; the prerender works without it because public pages never touch the DB.

## Repo quirks

- `obj/Debug/...` files and `wwwroot/lib/` are tracked in git even though `.gitignore` lists them; builds modify the tracked `obj` files. Avoid committing those incidental changes.
- `VuSolutionsWeb.csproj` excludes `node_modules`, `dist`, `.build`, `.wrangler`, `src`, `d1-migrations` and `package*.json` from the Web SDK's default items; keep that, or Node/Worker files get swept into the .NET publish output.
- `wwwroot/files/Vu-Resume-Latest.pdf` is public and currently includes the references' personal phone numbers and emails.
