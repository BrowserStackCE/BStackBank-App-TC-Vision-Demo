// Slack slash command -> GitHub workflow_dispatch relay (Cloudflare Worker, free tier).
//
// /automate            -> runs tc-automate with the workflow's default number of cases
// /automate 3          -> runs tc-automate with num_cases=3
//
// Secrets (wrangler secret put ...):
//   SLACK_SIGNING_SECRET   Slack app -> Basic Information -> Signing Secret
//   GITHUB_TOKEN           token with Actions: read/write on the repo that holds tc-automate.yml
// Vars (wrangler.toml):
//   GITHUB_REPO, WORKFLOW_FILE, REF, ALLOWED_SLACK_USER_IDS (comma separated, optional)

const enc = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSlackRequest(request, rawBody, signingSecret) {
  const ts = request.headers.get('X-Slack-Request-Timestamp');
  const sig = request.headers.get('X-Slack-Signature');
  if (!ts || !sig) return false;
  // Reject replays older than 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${ts}:${rawBody}`));
  return safeEqual(`v0=${hex(mac)}`, sig);
}

function reply(text, inChannel = false) {
  return new Response(
    JSON.stringify({ response_type: inChannel ? 'in_channel' : 'ephemeral', text }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ok');

    const rawBody = await request.text();
    if (!(await validSlackRequest(request, rawBody, env.SLACK_SIGNING_SECRET))) {
      return new Response('invalid signature', { status: 401 });
    }

    const form = new URLSearchParams(rawBody);
    const userId = form.get('user_id') || '';
    const userName = form.get('user_name') || userId;
    const arg = (form.get('text') || '').trim();

    const allowed = (env.ALLOWED_SLACK_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(userId)) {
      return reply(':no_entry: You are not allowed to start script generation.');
    }

    const inputs = {};
    if (arg) {
      if (!/^\d{1,2}$/.test(arg) || Number(arg) < 1) {
        return reply('Usage: `/automate` or `/automate <number of test cases>`, for example `/automate 3`.');
      }
      inputs.num_cases = String(Number(arg));
    }

    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'slack-automate-relay',
        },
        body: JSON.stringify({ ref: env.REF || 'main', inputs }),
      }
    );

    if (res.status !== 204) {
      const detail = (await res.text()).slice(0, 300);
      return reply(`:x: GitHub refused to start the workflow (HTTP ${res.status}). ${detail}`);
    }

    const count = inputs.num_cases ? `${inputs.num_cases} test case(s)` : 'the default number of test cases';
    return reply(
      `:rocket: ${userName} started script generation for ${count}. Progress: https://github.com/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}`,
      true
    );
  },
};
