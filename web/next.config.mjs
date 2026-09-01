import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The pipeline and the web app share one .env at the repo root. Duplicating
// it into web/.env.local would mean two files to keep in sync, and two places
// a stale credential could hide. Load the parent instead.
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Real environment variables (Vercel, CI) always win over the file.
    if (value && !process.env[key]) process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
