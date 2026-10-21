# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal/business portfolio site for VU Solutions (Vo Hoan Vu) at https://vusolutions.net. It is authored as an ASP.NET Core 8 Razor Pages app, but production is **static**: the Razor pages are prerendered to HTML at build time and served by a static-assets-only Cloudflare Worker (`vusolutions`, free plan). No .NET runtime, database, or Identity runs in production. Single project, no test project.

## Commands

.NET SDK is pinned to 8.0.404 via `global.json`; Node 22+ is required by Wrangler (`.nvmrc`).

```bash
dotnet run --launch-profile https     # dev server: https://localhost:7037, http://localhost:5035
dotnet watch run                      # hot reload while editing .cshtml/.css

npm ci
npm run build      # scripts/prerender.mjs -> dist/ (publishes, runs the app on :5199, saves pages, copies wwwroot)
npm run preview    # wrangler dev, serves dist/ like production
npm run deploy     # wrangler deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN/ACCOUNT_ID)
npx wrangler deploy --dry-run

# EF Core migrations (PostgreSQL via Npgsql; local only, unused in production)
dotnet ef migrations add <Name>
dotnet ef database update
```

There are no tests or linters configured.

## Deployment

- `.github/workflows/deploy-cloudflare.yml` runs `npm run build` then `npm run deploy` on every push to `main`, using repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Pushing to `main` is a production deploy.
- `wrangler.jsonc` binds custom domains `vusolutions.net` and `www.vusolutions.net`, uses `drop-trailing-slash` HTML handling, and serves `dist/404.html` (from `Pages/NotFound.cshtml`) for unknown paths. `cloudflare/_headers` sets cache headers and is copied into `dist/`.
- **Adding a public page requires adding it to the `pages` list in `scripts/prerender.mjs`** (path -> output file, e.g. `/Home/Portfolio` -> `Home/Portfolio.html`) and to `wwwroot/sitemap.xml`. Anything not in that list is not deployed. Asset paths on Cloudflare are case-sensitive, unlike ASP.NET routing.
- Only GET-rendered markup survives prerendering: `OnPost` handlers, antiforgery, auth, and DB access do not work in production. `Pages/Home/Contact.cshtml` (server-side form) and `About.cshtml` are not linked and are not prerendered.

## Architecture

- **Public content is static Razor markup.** `Pages/Index.cshtml` (landing; contact is a `mailto:` link) and `Pages/Home/Portfolio.cshtml` hold the site content; their PageModels are essentially empty. The resume is served from `wwwroot/files/Vu-Resume-Latest.pdf` and is replaced in place.
- **Layout/SEO** live in `Pages/Shared/_Layout.cshtml`: meta/OpenGraph/Twitter tags are hardcoded to `https://vusolutions.net`, and the canonical URL is built from `Context.Request.Path` (correct after prerendering because the script requests each real path). `wwwroot/sitemap.xml`, `robots.txt`, and the JSON-LD in `Index.cshtml` are maintained by hand.
- **Identity** is configured in `Program.cs` with `AddIdentity<ApplicationUser, IdentityRole>` plus strict password/lockout and confirmed-email requirements. Scaffolded overrides are in `Areas/Identity/Pages/Account`. The login partial is commented out in the layout; Identity only works when running the app locally.
- **Data layer** (`Data/`, `Models/`): `ApplicationDbContext` extends `IdentityDbContext<ApplicationUser>` and renames Identity tables (`Users`, `Roles`, ...). It also declares DbSets for an unused project/time-tracking domain. The fluent relationship config in `OnModelCreating` is commented out; uncommenting it requires a new migration. `ConnectionStrings:DefaultConnection` is empty in `appsettings.json` (real values in gitignored `appsettings.*.json`); the prerender works without it because public pages never touch the DB.
- **Repositories**: generic `IRepository<T>`/`Repository<T>` is registered as scoped in DI. `ProjectRepository` exists but is **not** registered.

## Repo quirks

- `obj/Debug/...` files and `wwwroot/lib/` are tracked in git even though `.gitignore` lists them; builds modify the tracked `obj` files. Avoid committing those incidental changes.
- `VuSolutionsWeb.csproj` excludes `node_modules`, `dist`, `.build`, `.wrangler`, and `package*.json` from the Web SDK's default items; keep that, or Node files get swept into the .NET publish output.
- Frontend libs (Bootstrap, jQuery, jquery-validation) are vendored under `wwwroot/lib`; Font Awesome 6 loads from cdnjs. npm is used only for Wrangler, not for bundling.
