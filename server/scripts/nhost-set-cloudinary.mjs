// Update only the Cloudinary env vars on Nhost, merging with existing ones.
// Usage: NHOST_PAT=<token> node scripts/nhost-set-cloudinary.mjs
//
// Targets the LIVE project by default (subdomain ybgaidcwksqeuojraxoe /
// region ap-southeast-1). Credentials are read from server/.env, never
// hardcoded. Override project with NHOST_SUBDOMAIN / NHOST_REGION, and pass
// NHOST_APP_ID if the app id cannot be auto-resolved.
import { readFileSync } from "node:fs";
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

const localEnv = parseEnv(resolve(serverDir, ".env"));
const cloudinary = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
  .filter((name) => localEnv[name])
  .map((name) => ({ name, value: localEnv[name] }));
if (cloudinary.length !== 3) {
  console.error("Missing CLOUDINARY_* vars in server/.env");
  process.exit(1);
}

const authRes = await fetch(`${AUTH_URL}/signin/pat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ personalAccessToken: pat }),
});
const authJson = await authRes.json();
const token = authJson.session?.accessToken;
if (!token) {
  console.error("PAT exchange failed", authRes.status);
  process.exit(1);
}

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

// MERGE with existing vars — updateConfig REPLACES the whole array, so a
// partial update here would wipe DATABASE_URL/SITE_URL/CRON_SECRET.
const { app } = await gql(
  'query Q($id: uuid!) { app(id: $id) { config(resolve: true) { global { environment { name value } } } } }',
  { id: APP_ID }
);
const existing = app.config.global.environment;
const merged = existing.filter((e) => !cloudinary.some((c) => c.name === e.name));
const environment = [...merged, ...cloudinary];
console.log("Merged env (preserving):", merged.map((e) => e.name).join(", "));

const res = await fetch(GRAPHQL_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    query: `mutation U($id: uuid!, $config: ConfigConfigUpdateInput!) {
      updateConfig(appID: $id, config: $config) { global { environment { name } } }
    }`,
    variables: { id: APP_ID, config: { global: { environment } } },
  }),
});
const d = await res.json();
if (d.errors) {
  console.error("ERROR", JSON.stringify(d.errors));
  process.exit(1);
}
console.log("✅ Nhost Cloudinary env vars:", d.data.updateConfig.global.environment.map((e) => e.name).join(", "));
