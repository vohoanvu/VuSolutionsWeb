# Status

Last updated: 2026-10-31

## Current state

- **Live:** https://vusolutions.net and https://www.vusolutions.net, served by the Cloudflare Worker `vusolutions` (Workers Free).
- **Deployed commit:** `231f8c8` on `main` (Actions run #6, success).
- **Build toolchain:** .NET 10 (SDK 10.0.403, `net10.0`), Node 22, Wrangler 4. .NET only runs at build time to prerender the Razor pages; production serves static HTML from `dist/` plus the Worker for `/api/*` and the resume PDF.
- **CI:** `.github/workflows/deploy-cloudflare.yml` on every push to `main`: `npm test` → `npm run build` → `wrangler deploy`. Actions: `checkout@v7`, `setup-dotnet@v6`, `setup-node@v7` (all Node 24).
- **Published output:** 27 files (5 prerendered pages, `css/`, `js/`, `images/`, `files/`, `sitemap.xml`, `robots.txt`, `favicon.ico`, `_headers`).

## Done

### 2026-10-30 / 31: .NET 10 upgrade and cleanup

| PR / commit | Change |
| --- | --- |
| vohoanvu/VuSolutionsWeb#1 (`20e28db`) | .NET 8 → .NET 10. Disabled publish-time static asset compression (`.gz`/`.br` copies bloated `dist/` from 144 to 395 files). Opted the JSON-LD `<script>` out of .NET 10's `ScriptTagHelper` with `<!script>`, which otherwise encoded `ld+json` as `ld&#x2B;json`. |
| vohoanvu/VuSolutionsWeb#2 (`9e2c3e9`, `463c5ce`) | Removed the unused Identity / EF Core / Npgsql code, models, migrations and packages (Identity UI was publishing ~60 files under `/Identity/`). Moved CI actions off the deprecated Node 20 runtime. |
| `231f8c8` (pushed to `main`) | Removed `wwwroot/lib` (Bootstrap, jQuery, jquery-validation; 7.9 MB, unused), the legacy `Pages/Home/Contact`, `About` and `Privacy` views, and `_ValidationScriptsPartial`. |

Each change was checked by building `dist/` before and after and diffing: every prerendered page stayed byte-identical; only dead files were removed. After each deploy, the live pages were compared against the local build and the removed paths confirmed as 404.

Net effect: 147 → 27 deployed files; `dotnet build` has 0 warnings (the NU1901 `NuGet.Packaging` advisory went away with the scaffolding package).

## Open

- **Public resume contains references' personal contact details.** `/files/Vu-Resume-Latest.pdf` (KV-served, with the bundled `wwwroot/files` copy as fallback) includes references' phone numbers and emails. Deferred by the owner until the resume is next updated. To fix: upload a redacted PDF at `/admin/resume` (live immediately), then replace `wwwroot/files/Vu-Resume-Latest.pdf` so the fallback and the repo match. The old file remains in git history.
- **Contact form not exercised since the upgrade.** `src/worker.js` was not changed, but no real submission has been sent through production since these deploys. One test submission would confirm Turnstile → D1 → email still work end to end.
- **Stale tracked build files.** `obj/Debug/net8.0/*` is still tracked in git despite `.gitignore`. Harmless; could be removed with `git rm -r --cached obj`.
- **npm audit:** CI reports 3 vulnerabilities (2 moderate, 1 high) in the Node dev dependencies. Not yet reviewed.

## Notes for next time

- Pushing to `main` is a production deploy; there is no staging.
- `wrangler deploy` reports a "Read N files" count that includes directories, so it is higher than `find dist -type f`.
- Don't add NuGet packages that ship static web assets (e.g. `Microsoft.AspNetCore.Identity.UI`) without checking `dist/`: they get deployed publicly.
