// Set Nhost GLOBAL environment variables (the ones Functions/Run services read)
// via updateConfig, and clean up the app secrets previously inserted by mistake.
// Usage: NHOST_PAT=<token> node scripts/nhost-set-secrets.mjs
//
// Targets the LIVE project by default (subdomain ybgaidcwksqeuojraxoe /
// region ap-southeast-1). Override with NHOST_SUBDOMAIN / NHOST_REGION, and if
// the app id cannot be auto-resolved, pass NHOST_APP_ID.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SUBDOMAIN = process.env.NHOST_SUBDOMAIN || "ybgaidcwksqeuojraxoe";
const REGION = process.env.NHOST_REGION || "ap-southeast-1";
const AUTH_URL = `https://${SUBDOMAIN}.auth.${REGION}.nhost.run/v1`;
const GRAPHQL_URL = `https://${SUBDOMAIN}.graphql.${REGION}.nhost.run/v1/graphql`;

const pat = process.env.NHOST_PAT;
if (!pat) {
  console.error("Missing NHOST_PAT env var");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..");

function parseEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    // file may not exist
  }
  return out;
}

const nhostEnv = parseEnv(resolve(serverDir, ".env.nhost"));
const localEnv = parseEnv(resolve(serverDir, ".env"));

const dbUrl = nhostEnv.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found in server/.env.nhost");
  process.exit(1);
}

const desired = {
  DATABASE_URL: dbUrl,
  SITE_URL: "https://www.bridgecollectiveopport.org",
  CRON_SECRET: randomBytes(24).toString("base64url"),
  CLOUDINARY_CLOUD_NAME: localEnv.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: localEnv.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: localEnv.CLOUDINARY_API_SECRET,
};
for (const [k, v] of Object.entries(desired)) {
  if (!v) console.warn(`⚠️  ${k} is empty — skipping`);
}

// exchange PAT for access token
const authRes = await fetch(`${AUTH_URL}/signin/pat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ personalAccessToken: pat }),
});
const authJson = await authRes.json();
if (!authJson?.session?.accessToken) {
  console.error("PAT exchange failed", authRes.status, JSON.stringify(authJson));
  process.exit(1);
}
const token = authJson.session.accessToken;

async function gql(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// resolve the app id for the target project (auto-detect, then env override)
let APP_ID = process.env.NHOST_APP_ID;
if (!APP_ID) {
  try {
    const { apps } = await gql("query Q { apps { id subdomain } }");
    const match = apps?.find((a) => a.subdomain === SUBDOMAIN);
    if (match) APP_ID = match.id;
  } catch {
    // fall through to explicit env var
  }
}
if (!APP_ID) {
  console.error(
    `Could not resolve app id for subdomain "${SUBDOMAIN}". ` +
      "Copy it from the Nhost dashboard URL (app.nhost.io/project/<id>) and retry with NHOST_APP_ID=<id>."
  );
  process.exit(1);
}
console.log(`ℹ️  Targeting project "${SUBDOMAIN}" (${REGION}) appId=${APP_ID}`);

// 1. Set global environment variables (what Functions actually read)
const environment = Object.entries(desired)
  .filter(([, v]) => v)
  .map(([name, value]) => ({ name, value }));

const upd = await gql(
  `mutation U($id: uuid!, $config: ConfigConfigUpdateInput!) {
     updateConfig(appID: $id, config: $config) { global { environment { name } } }
   }`,
  { id: APP_ID, config: { global: { environment } } }
);
console.log("✅ updateConfig → global.environment:", environment.map((e) => e.name).join(", "));

// 2. Clean up the app secrets inserted earlier (functions don't read those)
const CLEANUP = ["DATABASE_URL", "SITE_URL", "CRON_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
const { appSecrets } = await gql("query Q($id: uuid!) { appSecrets(appID: $id) { name } }", { id: APP_ID });
for (const name of CLEANUP) {
  if (appSecrets.some((s) => s.name === name)) {
    await gql("mutation D($id: uuid!, $key: String!) { deleteSecret(appID: $id, key: $key) { name } }", { id: APP_ID, key: name });
    console.log(`🗑️  deleted app secret ${name}`);
  }
}

console.log("\nDone. Trigger a redeploy (push to master) so functions pick up the new global env vars.");
