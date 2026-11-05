# Slack `/automate` -> GitHub workflow relay

Type `/automate 3` in Slack and the `tc-automate` workflow starts for 3 test cases. Free: Slack + a Cloudflare Worker (free tier) + GitHub.

Flow: Slack slash command -> this Worker (verifies Slack's signature) -> GitHub `workflow_dispatch` API -> `tc-automate.yml`.

## One-time setup

### 1. GitHub token (can start workflows)
Fine-grained personal access token: Resource owner = the owner of this repo, Repository access = only this repo, permission **Actions: Read and write**. Copy it.

### 2. Deploy the Worker
```
cd slack-relay
npx wrangler login
npx wrangler secret put GITHUB_TOKEN          # paste the token from step 1
npx wrangler secret put SLACK_SIGNING_SECRET  # from step 3 (Slack app -> Basic Information)
npx wrangler deploy
```
`wrangler deploy` prints the Worker URL, e.g. `https://slack-automate-relay.<you>.workers.dev`. If you deploy before step 3, run `wrangler secret put SLACK_SIGNING_SECRET` afterwards.

### 3. Slack app command
In your Slack app (api.slack.com/apps -> your app):
1. **Slash Commands -> Create New Command**: Command `/automate`, Request URL = the Worker URL, short description "Generate test scripts", usage hint `[number of test cases]`.
2. **Basic Information -> Signing Secret**: copy it into the `SLACK_SIGNING_SECRET` secret above.
3. Reinstall the app to the workspace if Slack asks.

### 4. Optional: restrict who can run it
Put Slack member IDs (profile -> More -> Copy member ID) in `ALLOWED_SLACK_USER_IDS` in `wrangler.toml`, comma separated, then `npx wrangler deploy`.

## Use
- `/automate` runs with the workflow's default number of cases.
- `/automate 3` runs with 3.
- The channel gets a message with a link to the run.

## Notes
- Slack requires a reply within 3 seconds; the Worker only triggers the workflow and replies, the work happens in GitHub.
- Keep the GitHub token and signing secret out of the repo; they live only as Worker secrets.
