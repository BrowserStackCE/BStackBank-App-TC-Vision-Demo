#!/usr/bin/env node
// Uploads an APK to BrowserStack App Automate with a stable custom_id and prints the result.
// Usage: node scripts/upload-to-appautomate.js <apk> <customId>
// Env:   BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
// Writes GitHub Actions outputs (bs_url, custom_id, shareable_id) when GITHUB_OUTPUT is set.
// No dependencies: Node 18+ (fetch, FormData, Blob).
const fs = require('fs');
const { Buffer } = require('buffer');

async function main() {
  const [file, customId] = process.argv.slice(2);
  if (!file || !fs.existsSync(file)) throw new Error(`APK not found: ${file}`);
  if (!customId || !/^[A-Za-z0-9_-]+$/.test(customId))
    throw new Error('customId is required and may only contain letters, digits, _ and -');
  const user = process.env.BROWSERSTACK_USERNAME;
  const key = process.env.BROWSERSTACK_ACCESS_KEY;
  if (!user || !key) throw new Error('BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY not set');

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), file.split('/').pop());
  form.append('custom_id', customId);

  const res = await fetch('https://api-cloud.browserstack.com/app-automate/upload', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64') },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App Automate upload failed: ${res.status} ${text}`);
  const out = JSON.parse(text);
  if (!out.app_url) throw new Error(`No app_url in response: ${text}`);

  console.log(`Uploaded to App Automate: ${out.app_url} (custom_id: ${out.custom_id})`);
  if (out.shareable_id) console.log(`Shareable id: ${out.shareable_id}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `bs_url=${out.app_url}\ncustom_id=${out.custom_id || customId}\nshareable_id=${out.shareable_id || ''}\n`
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
