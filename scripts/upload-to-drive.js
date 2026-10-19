#!/usr/bin/env node
// Uploads a file to a Google Drive (Shared Drive) folder using a service account.
// Usage: node scripts/upload-to-drive.js <file> [remoteName]
// Env:   GDRIVE_SERVICE_ACCOUNT_JSON (raw JSON, optionally quoted or base64), GDRIVE_FOLDER_ID
// No dependencies: uses Node 18+ fetch and crypto.
const fs = require('fs');
const crypto = require('crypto');

const b64url = (b) =>
  Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Accepts raw JSON, JSON wrapped in single/double quotes, or base64 of the JSON.
function parseServiceAccount(input) {
  let s = String(input || '').trim();
  const attempts = [];
  attempts.push(s);
  if (/^(['"]).*\1$/s.test(s)) attempts.push(s.slice(1, -1).trim());
  try {
    attempts.push(Buffer.from(s, 'base64').toString('utf8').trim());
  } catch (_) {}
  for (const a of attempts) {
    if (!a.startsWith('{')) continue;
    try {
      const sa = JSON.parse(a);
      if (sa.client_email && sa.private_key) return sa;
    } catch (_) {}
  }
  throw new Error(
    `GDRIVE_SERVICE_ACCOUNT_JSON could not be parsed (length ${s.length}, first char code ${
      s ? s.charCodeAt(0) : 'none'
    }). Paste the full service-account JSON file content as the secret, without extra quotes.`
  );
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  const [file, remoteName] = process.argv.slice(2);
  if (!file || !fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  const folderId = (process.env.GDRIVE_FOLDER_ID || '').trim().replace(/^['"]|['"]$/g, '');
  if (!folderId) throw new Error('GDRIVE_FOLDER_ID is not set');
  if (!process.env.GDRIVE_SERVICE_ACCOUNT_JSON) throw new Error('GDRIVE_SERVICE_ACCOUNT_JSON is not set');
  const sa = parseServiceAccount(process.env.GDRIVE_SERVICE_ACCOUNT_JSON);

  const token = await getToken(sa);
  const name = remoteName || file.split('/').pop();
  const boundary = 'bndry' + crypto.randomBytes(8).toString('hex');
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n`
    ),
    fs.readFileSync(file),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  const out = await res.json();
  console.log(`Uploaded "${out.name}" (id: ${out.id})`);
  if (out.webViewLink) console.log(out.webViewLink);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
