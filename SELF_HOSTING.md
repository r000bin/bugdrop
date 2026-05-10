# Self-Hosting Guide

Run your own instance of BugDrop with your own GitHub App.

## Prerequisites

- Node.js 20+
- Cloudflare account (free tier works)
- GitHub account

## 1. Create a GitHub App

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Configure:
   - **Name**: Choose a unique name (becomes your app's URL slug)
   - **Homepage URL**: Your worker URL (e.g., `https://bugdrop.you.workers.dev`)
   - **Webhook**: Uncheck "Active" (not needed)
3. Set permissions:
   - **Repository > Issues**: Read & Write
   - **Repository > Contents**: Read & Write
4. Click "Create GitHub App"
5. Note the **App ID** (shown at top)
6. Scroll down and click **"Generate a private key"** (downloads a .pem file)

## 2. Clone, Install, and Configure

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/bugdrop
cd bugdrop
make install

# Configure environment
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your GitHub App credentials:

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your key content...
-----END RSA PRIVATE KEY-----"
```

Next, update `wrangler.toml` with your app name and remove the upstream KV namespace IDs:

```toml
[vars]
GITHUB_APP_NAME = "your-app-name"  # Must match your GitHub App's URL slug

# Remove or replace the [[kv_namespaces]] section (and the
# [[env.preview.kv_namespaces]] section) — the existing IDs belong
# to the upstream deployment. See Step 5 to create your own,
# or delete both sections entirely to disable rate limiting.
```

> **Note:** The test pages under `public/test/` have `data-repo` set to `mean-weasel/bugdrop-widget-test`. Change this in all test HTML files to a repo where your GitHub App is installed:
>
> ```bash
> # macOS / BSD sed
> find public/test -name '*.html' -exec sed -i '' 's/mean-weasel\/bugdrop-widget-test/your-org\/your-repo/g' {} +
> ```

## 3. Build the Widget

The widget source must be compiled before the dev server can serve it (the built files are not checked into git):

```bash
make build-widget
```

## 4. Run Locally

```bash
make dev
# Opens http://localhost:8787
```

Visit http://localhost:8787/test/ to try the widget.

## 5. Set Up Rate Limiting (Optional)

Rate limiting prevents spam and protects GitHub API quotas. It uses Cloudflare KV for distributed storage.

> **Important:** The `[[kv_namespaces]]` IDs in `wrangler.toml` belong to the upstream deployment and will not work for your account. You must create your own namespaces below, or remove the section to disable rate limiting.

```bash
# Create KV namespaces
npx wrangler kv:namespace create RATE_LIMIT
npx wrangler kv:namespace create RATE_LIMIT --preview
```

Copy the IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<your-production-id>"
preview_id = "<your-preview-id>"
```

**Default limits:**

- 20 requests per 15 minutes per IP
- 50 requests per hour per repository

To customize limits, edit `src/middleware/rateLimit.ts` and the middleware config in `src/routes/api.ts`.

> **Note:** If you skip this step, rate limiting is disabled but the app still works.

## 6. Deploy to Cloudflare

### Manual Deploy

```bash
# Set production secrets
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_PRIVATE_KEY

# Deploy
make deploy
```

### Auto-Deploy via GitHub Releases

The CI workflow automatically deploys to Cloudflare when you publish a GitHub Release. This gives you explicit control over when updates go to production.

**Setup (one-time):**

1. Get your Cloudflare credentials:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Profile → API Tokens
   - Create a token with **Workers Scripts: Edit** permission
   - Note your **Account ID** from the Workers overview page

2. Add secrets to your GitHub repository:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add these repository secrets:
     - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
     - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**To deploy a new version:**

1. Merge your PRs to `main` (tests run, but no deploy)
2. Go to your repo → Releases → **Create a new release**
3. Create a new tag (e.g., `v1.2.0`) following semver
4. Add release notes describing changes
5. Click **Publish release**
6. CI will automatically build and deploy to Cloudflare

The release tag (e.g., `v1.2.0`) becomes the version number for the widget files.

## Configuration

### Environment Variables

| Variable                       | Required | Description                                                           |
| ------------------------------ | -------- | --------------------------------------------------------------------- |
| `GITHUB_APP_ID`                | Yes      | Your GitHub App's numeric ID                                          |
| `GITHUB_PRIVATE_KEY`           | Yes      | Private key from GitHub App settings                                  |
| `ENVIRONMENT`                  | No       | `development` disables rate limiting; `production` enables all checks |
| `ALLOWED_ORIGINS`              | No       | Comma-separated allowed domains (default: `*`)                        |
| `GITHUB_APP_NAME`              | No       | Your app's URL slug for install links                                 |
| `MAX_SCREENSHOT_SIZE_MB`       | No       | Max screenshot size in MB (default: `5`)                              |
| `CATEGORY_LABELS`              | No       | JSON mapping from repos/categories to GitHub labels                   |
| `ALLOW_CLIENT_CATEGORY_LABELS` | No       | Set to `true` to trust `data-category-labels` from your own pages     |
| `RATE_LIMIT`                   | No       | KV namespace binding for rate limiting (see section 5)                |

### Custom Category Labels

For authoritative mappings, configure labels on the worker. Two JSON shapes are supported.

**Flat** — applies to every repo your worker serves:

```toml
[vars]
CATEGORY_LABELS = '{"bug":["defect","frontend"],"feature":"product-feedback","question":"support"}'
```

**Per-repo** with optional `"*"` wildcard fallback:

```toml
[vars]
CATEGORY_LABELS = '{"owner/repo":{"bug":["defect","frontend"]},"*":{"bug":"triage"}}'
```

The shape is detected automatically: top-level keys containing `/` or equal to `*` are treated as repos; otherwise the object is treated as flat.

Validation rules:

- Recognized categories: `bug`, `feature`, `question`. Unknown keys are dropped with a warning.
- Each category accepts a single label or an array of **1-5** labels.
- Each label must be **1-50 characters** after trimming (matching GitHub's label-name limit). Whitespace-only labels and labels containing control characters (newlines, NUL, etc.) are rejected.
- Every issue also receives the `bugdrop` label automatically.

Self-hosted deployments can also opt into script-tag mappings by setting `ALLOW_CLIENT_CATEGORY_LABELS = "true"` (case-sensitive — values like `"True"`, `"1"`, or `"yes"` keep the gate closed) and using `data-category-labels` on pages you control. Only enable this when your worker is locked down to trusted origins.

When both are set, `CATEGORY_LABELS` takes precedence: the worker uses the server-side mapping and ignores `data-category-labels`. If `CATEGORY_LABELS` is set but unusable (malformed JSON, wrong shape, or a per-repo map with no entry for the current repo and no `"*"` fallback), the worker falls back to default GitHub labels and surfaces a warning in the issue body — it does **not** fall through to the browser-supplied mapping. This keeps a typo in your env config from silently handing label control back to the page.

Warnings emitted during label resolution are also written to worker logs (visible via `wrangler tail`) and returned in the `/feedback` success response under `labelMappingWarnings` so monitoring can detect misconfigurations without parsing issue bodies.

### Locking Down Allowed Origins (Recommended)

> **Security:** When self-hosting, you should always set `ALLOWED_ORIGINS` to only the domains where you embed the widget. The default `"*"` allows any website to submit requests to your worker — meaning anyone who discovers your worker URL could create issues on repos where your app is installed (subject to rate limits).

For self-hosted deployments, restrict origins to your known domains:

```toml
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://mysite.com,https://app.mysite.com"
GITHUB_APP_NAME = "my-bugdrop-app"
```

Only list the exact origins (scheme + host) of sites where you embed the BugDrop widget. The worker validates the `Origin` header on incoming requests and rejects any not in this list.

> **Note:** `ALLOWED_ORIGINS` is a CORS-level check — it only blocks browser-based cross-origin requests. Direct API calls (curl, scripts) don't send an `Origin` header and bypass CORS entirely. Rate limiting (section 5) is your primary defense against non-browser abuse.

### Root URL Redirect

By default, the worker redirects `/` to `https://bugdrop.dev` (the upstream landing page). For your own deployment, edit `src/index.ts` and change the redirect URL to your own site, or replace it with a custom response:

```ts
// src/index.ts — change this route handler:
app.get('/', c => {
  return c.redirect('https://your-site.com', 301);
});
```

## Commands

```bash
make help        # Show all commands
make dev         # Start dev server (localhost:8787)
make check       # Run lint, typecheck, knip
make test        # Run unit tests
make test-e2e    # Run E2E tests
make ci          # Run full CI pipeline
make build-all   # Build widget + worker
make deploy      # Deploy to Cloudflare
```

## Project Structure

```
src/
├── index.ts           # Worker entry
├── routes/api.ts      # API endpoints
├── lib/github.ts      # GitHub API
└── widget/            # Client widget
    ├── index.ts       # Entry point
    ├── ui.ts          # UI + theming
    ├── screenshot.ts  # Capture
    ├── picker.ts      # Element selection
    └── annotator.ts   # Drawing tools
```

## Tech Stack

- **Runtime**: Cloudflare Workers + Hono
- **Auth**: GitHub App (installation tokens)
- **Widget**: TypeScript IIFE in Shadow DOM
- **Testing**: Vitest + Playwright
