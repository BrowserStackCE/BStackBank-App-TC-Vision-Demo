#!/usr/bin/env node
// Resolves an App Automate app reference to a real bs://<hash> id.
// Usage: node scripts/resolve-bs-app.js <bs://hash | bs://CustomId | CustomId | user/CustomId>
// Env:   BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
// Prints the bs:// id on stdout. Exits 1 if the app cannot be found.
const { Buffer } = require('buffer');

async function main() {
  const raw = (process.argv[2] || '').trim();
  if (!raw) throw new Error('app reference is required');
  const user = process.env.BROWSERSTACK_USERNAME;
  const key = process.env.BROWSERSTACK_ACCESS_KEY;
  if (!user || !key) throw new Error('BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY not set');

  const ref = raw.replace(/^bs:\/\//, '');
  // A real app id is a 40-char hex hash; use it as-is.
  if (/^[0-9a-f]{40}$/i.test(ref)) {
    console.log(`bs://${ref}`);
    return;
  }
  const customId = ref.includes('/') ? ref.split('/').pop() : ref;
  const res = await fetch(
    `https://api-cloud.browserstack.com/app-automate/recent_apps/${encodeURIComponent(customId)}`,
    { headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64') } }
  );
  if (!res.ok) throw new Error(`Lookup failed for "${customId}": ${res.status} ${await res.text()}`);
  const apps = await res.json();
  if (!Array.isArray(apps) || apps.length === 0 || !apps[0].app_url)
    throw new Error(`No uploaded app found for custom id "${customId}"`);
  // The API lists the newest upload first.
  console.log(apps[0].app_url);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
