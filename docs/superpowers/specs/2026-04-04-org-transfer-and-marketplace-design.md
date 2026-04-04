# BugDrop Org Transfer & Marketplace Listing — Design Spec

**Date:** 2026-04-04
**Status:** Draft

## Goal

Transfer bugdrop and feedback-widget-test from `neonwatty` (personal account) to `mean-weasel` (organization), create a new `bugdrop` GitHub App under the org, set up the Vercel preview deployment pipeline, and list the app on the GitHub Marketplace.

## Why

- GitHub merge queue (needed for serialized preview E2E tests) requires an org repo
- GitHub Marketplace listing requires the app to be owned by an org
- Consolidates project identity under the mean-weasel org

## What stays the same

- **Cloudflare Workers URL**: `bugdrop.neonwatty.workers.dev` — unchanged, existing user embeds keep working
- **Widget behavior**: zero user-facing impact
- **GitHub redirects**: GitHub auto-redirects all `neonwatty/bugdrop` URLs (web, git, API) to `mean-weasel/bugdrop`

## Blast radius

External references found via GitHub code search:

| Reference | Location | Impact |
|-----------|----------|--------|
| App install URL (`neonwatty-bugdrop`) | `neonwatty/blog`, `mean-weasel/growth` | Own repos — update manually |
| Widget embed URL | `mean-weasel/growth` (2 docs) | Own repo — update manually |
| External users | None found in public code search | Low risk |

Current GitHub App installations: handful of test users (exact count requires app-level JWT auth to verify).

---

## Phase 1: GitHub Transfers & New App (manual)

### 1.1 Transfer repos

Transfer both repos via GitHub UI (Settings → Danger Zone → Transfer):

| From | To |
|------|----|
| `neonwatty/bugdrop` | `mean-weasel/bugdrop` |
| `neonwatty/feedback-widget-test` | `mean-weasel/feedback-widget-test` |

GitHub automatically:
- Sets up redirects from old URLs to new URLs (git, web, API)
- Transfers all issues, PRs, releases, stars, watchers
- Moves CI secrets (they stay attached to the repo)

### 1.2 Create new GitHub App under org

Create a new GitHub App at `https://github.com/organizations/mean-weasel/settings/apps/new`:

| Field | Value |
|-------|-------|
| Name | `BugDrop` (slug will be `bugdrop`) |
| Homepage URL | `https://github.com/mean-weasel/bugdrop` |
| Webhook | Disable (not used — the app only needs installation tokens) |
| Permissions | Repository: Contents (read & write), Issues (read & write), Metadata (read) |
| Where can this app be installed? | Any account |

Generate a private key and note the App ID.

### 1.3 Install new app on both repos

Install the `bugdrop` app on `mean-weasel/bugdrop` and `mean-weasel/feedback-widget-test`.

### 1.4 Update Cloudflare Workers secrets

Update the wrangler secrets to use the new app's credentials:

```bash
wrangler secret put GITHUB_APP_ID        # new app ID
wrangler secret put GITHUB_PRIVATE_KEY   # new app private key
```

Also update the GitHub Actions secrets in the `mean-weasel/bugdrop` repo settings:
- `CLOUDFLARE_API_TOKEN` — verify these transferred with the repo
- `CLOUDFLARE_ACCOUNT_ID` — verify these transferred with the repo

### 1.5 Notify existing app users

If there are installations of `neonwatty-bugdrop` beyond test repos:
- Add a notice to the old app's description pointing to the new `bugdrop` app
- Keep the old app active for a transition period (e.g., 30 days)
- Eventually mark old app as deprecated or delete it

If only test repos: simply uninstall the old app and delete it.

---

## Phase 2: Update All References (code changes)

Two PRs — one per repo. All changes are find-and-replace with manual review.

### 2.1 bugdrop repo (89 references across 28 files)

**Replacements:**

| Find | Replace | Files affected |
|------|---------|----------------|
| `neonwatty/bugdrop` | `mean-weasel/bugdrop` | README, CHANGELOG, CONTRIBUTING, TERMS, PRIVACY, SECURITY, api.ts, ui.ts, specs, plans, public/index.html |
| `neonwatty/feedback-widget-test` | `mean-weasel/feedback-widget-test` | test HTML files, e2e tests, specs, plans |
| `neonwatty-bugdrop` (app slug) | `bugdrop` | wrangler.toml, src/widget/index.ts, public/index.html, README, specs |
| `neonwatty.github.io/feedback-widget-test/` | Vercel production URL (TBD after Phase 3) | README, public/index.html, specs |
| `neonwatty@gmail.com` | `jeremy@mean-weasel.com` | SECURITY.md |
| `Built by <a href="https://github.com/neonwatty"` | `Built by <a href="https://github.com/mean-weasel"` | public/index.html |

**Special cases requiring careful edits (not blind find-replace):**

- `src/widget/index.ts:698-699` — hardcoded domain check for app name:
  ```typescript
  const appName = config.apiUrl.includes('bugdrop.neonwatty.workers.dev')
    ? 'neonwatty-bugdrop'
  ```
  Update the fallback app name to `bugdrop`. The domain check stays as-is (CF Workers URL unchanged).

- `wrangler.toml` — top-level `GITHUB_APP_NAME` var:
  ```toml
  GITHUB_APP_NAME = "bugdrop"
  ```
  Also update `[env.preview.vars]` section.

- `github.com/apps/neonwatty-bugdrop/installations/new` → `github.com/apps/bugdrop/installations/new` (README, public/index.html)

**Do NOT change:**
- `bugdrop.neonwatty.workers.dev` — CF Workers URL stays unchanged
- CHANGELOG version comparison URLs — historical references, GitHub redirects handle them

### 2.2 feedback-widget-test repo (24 references across 4 files)

**Replacements:**

| Find | Replace | Files affected |
|------|---------|----------------|
| `neonwatty/bugdrop` | `mean-weasel/bugdrop` | App.tsx, index.html, README |
| `neonwatty/feedback-widget-test` | `mean-weasel/feedback-widget-test` | App.tsx, index.html, README |
| `neonwatty-bugdrop` (app slug) | `bugdrop` | App.tsx, README |
| `neonwatty.github.io/feedback-widget-test/` | Vercel production URL (TBD) | README |

**Do NOT change:**
- `bugdrop.neonwatty.workers.dev` in vite.config.ts default — CF Workers URL stays unchanged

### 2.3 External repos (manual, low priority)

Update references in own repos found via code search:
- `neonwatty/blog` — blog post referencing app install URL
- `mean-weasel/growth` — 2 docs referencing widget embed URL and app install URL

---

## Phase 3: Vercel + CF Workers Preview Setup

### 3.1 Import feedback-widget-test into Vercel

1. Go to vercel.com/new, import `mean-weasel/feedback-widget-test`
2. Vercel auto-detects Vite — no config needed
3. Set environment variables in Vercel project settings:

   | Variable | Production | Preview |
   |----------|-----------|---------|
   | `VITE_BUGDROP_URL` | `https://bugdrop.neonwatty.workers.dev` | `https://bugdrop-preview.neonwatty.workers.dev` |

4. The `base: '/feedback-widget-test/'` in vite.config.ts is for GitHub Pages subpath. For Vercel (serves from root), remove it. Since GitHub Pages deployment is being replaced by Vercel, this is safe.

### 3.2 Get stable Vercel preview URL

Deploy a `preview` branch once:
```bash
git checkout -b preview
git push -u origin preview
```

Note the stable URL Vercel generates (e.g., `feedback-widget-test-git-preview-mean-weasel.vercel.app`).

### 3.3 Set up CF Workers preview environment

In `mean-weasel/bugdrop`:

```bash
wrangler kv namespace create RATE_LIMIT --env preview
# Use returned ID to replace <PREVIEW_KV_ID> in wrangler.toml

wrangler secret put GITHUB_APP_ID --env preview
wrangler secret put GITHUB_PRIVATE_KEY --env preview

wrangler deploy --env preview --dry-run  # verify [assets] inheritance
```

### 3.4 Fill in placeholders from bugdrop PR #65

Update `live-tests.yml`:
- Replace `<STABLE_VERCEL_PREVIEW_URL>` with the URL from step 3.2
- Replace `<ACCOUNT>` with `neonwatty` (CF account subdomain — unchanged)

Update `wrangler.toml`:
- Replace `<PREVIEW_KV_ID>` with the ID from step 3.3

### 3.5 Disable GitHub Pages for feedback-widget-test

Once Vercel is serving both production and preview:
1. Remove `.github/workflows/deploy.yml` (GitHub Pages workflow)
2. Disable GitHub Pages in repo settings
3. Update the Vercel production domain if desired

### 3.6 Enable merge queue

In `mean-weasel/bugdrop` repo settings:
- Rules → Branch protection for `main` → Require merge queue
- After 2-week bake period: add `Live Preview Tests / Live E2E Tests` as required check

---

## Phase 4: GitHub Marketplace Listing

### 4.1 Prerequisites

- App owned by org ✓ (Phase 1)
- App has a description, logo, and homepage URL
- Terms of service URL: `https://github.com/mean-weasel/bugdrop/blob/main/TERMS.md`
- Privacy policy URL: `https://github.com/mean-weasel/bugdrop/blob/main/PRIVACY.md`
- Support URL: `https://github.com/mean-weasel/bugdrop/issues`

### 4.2 Prepare listing assets

- **Logo**: create or use existing BugDrop logo (square, at least 200x200px)
- **Description**: "In-app feedback → GitHub Issues. Screenshots, annotations, the works."
- **Categories**: Developer Tools, Code Review
- **Pricing**: Free

### 4.3 Publish to Marketplace

1. Go to the app settings → Marketplace listing
2. Fill in all required fields
3. Add screenshots showing the widget in action
4. Set pricing plan to Free
5. Submit for review (GitHub reviews Marketplace submissions)

### 4.4 Update docs with Marketplace links

- Add Marketplace badge to README
- Update installation instructions to point to `github.com/marketplace/bugdrop`
- Update `public/index.html` install links

---

## Implementation Order

| Phase | Depends on | Automatable? |
|-------|-----------|-------------|
| Phase 1: Transfers & new app | — | Manual (GitHub UI) |
| Phase 2: Update references | Phase 1 | Code changes (2 PRs) |
| Phase 3: Vercel + preview setup | Phase 1 | Mix of manual (Vercel UI, wrangler CLI) and code changes |
| Phase 4: Marketplace listing | Phases 1-3 | Manual (GitHub UI) + code changes for docs |

Phases 2 and 3 can run in parallel after Phase 1 completes.

---

## Rollback plan

If something goes wrong after transfer:
- GitHub repo redirects are permanent (as long as no new repo takes the old name)
- CF Workers URL is unaffected — widget keeps working regardless
- Old GitHub App can stay active during transition
- Can transfer repos back to `neonwatty` if needed
