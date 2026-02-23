---
phase: 03-export-hardening-web-deployment
plan: 02
subsystem: infra, ui
tags: [cloudflare-workers, pwa, service-worker, webgl, safari, github-actions, ci-cd, vite-plugin-pwa]

# Dependency graph
requires:
  - phase: 02-catalog-browser-routing
    provides: TanStack Router hash-based routing, main.tsx entry point
  - phase: 03-export-hardening-web-deployment/01
    provides: Export preflight validation engine, DXF hardening
provides:
  - Persistent 3D Canvas mount preventing Safari WebGL context exhaustion
  - Cloudflare Workers static site deployment with SPA fallback
  - GitHub Actions CI/CD pipeline (build + type-check + deploy)
  - PWA service worker with offline app shell caching and catalog cache
  - Update prompting via useRegisterSW toast notification
  - Cloudflare Web Analytics beacon (privacy-friendly, no cookies)
affects: [phase-5, phase-6]

# Tech tracking
tech-stack:
  added: [wrangler, vite-plugin-pwa, workbox-window]
  patterns: [persistent-canvas-mount, css-visibility-toggle, frameloop-pause, pwa-prompt-update]

key-files:
  created:
    - wrangler.jsonc
    - .github/workflows/deploy.yml
    - src/components/UpdatePrompt.tsx
  modified:
    - src/components/MainContent.tsx
    - src/components/Preview3D.tsx
    - vite.config.ts
    - src/main.tsx
    - src/vite-env.d.ts
    - index.html
    - package.json

key-decisions:
  - "CSS display:none toggle instead of conditional render for 3D Canvas — prevents WebGL context creation/destruction on tab switch"
  - "frameloop='never' when 3D tab hidden — pauses render loop to save GPU while Canvas stays mounted"
  - "PWA registerType='prompt' — user sees toast on update, chooses when to refresh (no forced reload)"
  - "PWA icons deferred — manifest works without icons, install prompt deferred until branding ready"
  - "Cloudflare Web Analytics with PLACEHOLDER token — user replaces after enabling Web Analytics in dashboard"

patterns-established:
  - "Persistent Canvas pattern: Always mount GPU-heavy components, toggle visibility with CSS, pause render loop when hidden"
  - "PWA update prompt pattern: useRegisterSW hook with needRefresh state drives a fixed-position toast"

requirements-completed: [3D-01, PLAT-02]

# Metrics
duration: 32min
completed: 2026-02-22
---

# Phase 3 Plan 02: Web Deployment + Safari 3D Fix Summary

**Persistent 3D Canvas with CSS visibility toggle fixing Safari WebGL exhaustion, deployed to rackpro.prodro.pro via Cloudflare Workers with GitHub Actions CI/CD, PWA offline caching, and update prompting**

## Performance

- **Duration:** 32 min (includes checkpoint wait for human verification)
- **Started:** 2026-02-22T17:00:58Z
- **Completed:** 2026-02-22T17:33:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Fixed Safari WebGL context exhaustion by keeping 3D Canvas persistently mounted with CSS `display: none` toggle instead of conditional rendering
- Deployed app to rackpro.prodro.pro on Cloudflare Workers with SPA fallback routing
- GitHub Actions CI/CD pipeline runs type-check + build + deploy on every push to main
- PWA service worker caches app shell and catalog JSON for offline use after first visit
- UpdatePrompt component shows toast notification when new version deployed
- Cloudflare Web Analytics beacon added for privacy-friendly page view tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Safari 3D preview with persistent Canvas mount** - `57f6cbb` (fix)
2. **Task 2: Configure Cloudflare Workers deployment with PWA, CI/CD, and analytics** - `d839dcd` (feat)
3. **Task 3: Verify public deployment at rackpro.prodro.pro** - checkpoint:human-verify (user confirmed all checks pass)

**Plan metadata:** `704e4f9` (docs: complete plan)

## Files Created/Modified
- `src/components/MainContent.tsx` - Persistent Canvas mount with CSS visibility toggle and resize dispatch
- `src/components/Preview3D.tsx` - Added frameloop prop to pause render loop when hidden
- `vite.config.ts` - Added VitePWA plugin with service worker config, catalog caching, manifest
- `wrangler.jsonc` - Cloudflare Workers static asset config with SPA fallback routing
- `.github/workflows/deploy.yml` - CI/CD pipeline: checkout, install, type-check, build, deploy
- `src/components/UpdatePrompt.tsx` - Toast notification component wired to useRegisterSW
- `src/main.tsx` - Mounted UpdatePrompt in React tree outside router
- `src/vite-env.d.ts` - Added vite-plugin-pwa/react type reference
- `index.html` - Added Cloudflare Web Analytics beacon script
- `package.json` - Added wrangler, vite-plugin-pwa, workbox-window dev dependencies
- `package-lock.json` - Lockfile updated

## Decisions Made
- **CSS display:none over conditional render** -- Conditional rendering of `<Canvas>` creates/destroys WebGL contexts on every tab switch. Safari has a hard limit of 8-16 contexts before purging old ones. CSS visibility toggle keeps the single context alive.
- **frameloop='never' when hidden** -- Pauses the three.js render loop when the 3D tab is not active, saving GPU cycles while the Canvas stays mounted in the DOM.
- **Window resize dispatch on visibility** -- When switching back to the 3D tab, a 50ms-delayed resize event forces the Canvas to recalculate dimensions after CSS display change takes effect.
- **PWA registerType='prompt'** -- Chose prompt-based updates over auto-update to give users control over when to reload, avoiding mid-configuration data loss.
- **Icons deferred** -- PWA manifest works without icons (no install prompt, but offline caching and update prompting still function). Icons will be added when branding is finalized.
- **PLACEHOLDER analytics token** -- Cloudflare Web Analytics beacon included with placeholder token for user to replace after dashboard setup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale tsbuildinfo causing build failure**
- **Found during:** Task 2 (build verification)
- **Issue:** `tsc -b` (incremental build mode) failed with a stale `tsconfig.tsbuildinfo` referencing a missing `validationIssueIds` property that existed in the working tree but not in the committed version
- **Fix:** Deleted stale `tsconfig.tsbuildinfo` and re-ran `tsc -b` which succeeded
- **Files modified:** tsconfig.tsbuildinfo (deleted and regenerated)
- **Verification:** `npm run build` completed successfully with PWA service worker generated
- **Committed in:** N/A (tsbuildinfo is a build artifact, not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial build cache issue, no scope change.

## Issues Encountered
- Pre-existing `useConfigStore.ts` modification (adding `validationIssueIds`) was in the working tree but unrelated to this plan. It was committed separately by the 03-01 plan execution. Did not include it in Task 2 commit to maintain atomic task boundaries.

## User Setup Required

External services require manual configuration (completed by user during checkpoint):
- **CLOUDFLARE_API_TOKEN** -- GitHub Actions secret, from Cloudflare Dashboard -> API Tokens -> "Edit Cloudflare Workers" template
- **CLOUDFLARE_ACCOUNT_ID** -- GitHub Actions secret, from Cloudflare Dashboard -> Overview sidebar
- **Custom domain** -- rackpro.prodro.pro added in Cloudflare Dashboard -> Workers & Pages -> rackpro -> Domains & Routes
- **Web Analytics token** -- Replace PLACEHOLDER in index.html with actual token from Cloudflare Dashboard -> Web Analytics

## Next Phase Readiness
- App is publicly accessible at rackpro.prodro.pro
- Phase 3 complete -- all export hardening and web deployment objectives met
- Phases 4 (Wizard + Auto-Layout) and 5/6 (Cost Estimation + 3D Polish) can now proceed in parallel
- PWA icons and analytics token are minor follow-up items (non-blocking)

## Self-Check: PASSED

All 9 created/modified files verified present on disk. Both task commits (57f6cbb, d839dcd) verified in git log. SUMMARY.md exists.

---
*Phase: 03-export-hardening-web-deployment*
*Completed: 2026-02-22*
