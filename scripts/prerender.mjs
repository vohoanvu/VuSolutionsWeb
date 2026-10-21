// Builds the static site for Cloudflare: publishes the ASP.NET app, runs it locally,
// saves the rendered HTML of each public page, and copies wwwroot alongside it into dist/.
import { spawn, execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishDir = join(root, ".build", "publish");
const distDir = join(root, "dist");
const port = 5199;
const baseUrl = `http://127.0.0.1:${port}`;

// Request path -> output file. Asset paths are case-sensitive on Cloudflare.
const pages = [
  ["/", "index.html"],
  ["/Home/Portfolio", "Home/Portfolio.html"],
  ["/Privacy", "Privacy.html"],
  ["/NotFound", "404.html"],
];

rmSync(join(root, ".build"), { recursive: true, force: true });
rmSync(distDir, { recursive: true, force: true });

execSync(`dotnet publish VuSolutionsWeb.csproj -c Release -o "${publishDir}"`, {
  cwd: root,
  stdio: "inherit",
});

const server = spawn("dotnet", ["VuSolutionsWeb.dll"], {
  cwd: publishDir,
  env: { ...process.env, ASPNETCORE_URLS: baseUrl, ASPNETCORE_ENVIRONMENT: "Production" },
  stdio: ["ignore", "ignore", "inherit"],
});

try {
  await waitForHealthy();

  for (const [path, file] of pages) {
    const res = await fetch(baseUrl + path, { redirect: "manual" });
    if (res.status !== 200) throw new Error(`GET ${path} returned ${res.status}`);
    const out = join(distDir, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await res.text());
    console.log(`Rendered ${path} -> dist/${file}`);
  }

  cpSync(join(publishDir, "wwwroot"), distDir, { recursive: true });
  cpSync(join(root, "cloudflare"), distDir, { recursive: true });
  console.log("Static site written to dist/");
} finally {
  server.kill();
}

async function waitForHealthy() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited with code ${server.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not become healthy within 30s");
}
