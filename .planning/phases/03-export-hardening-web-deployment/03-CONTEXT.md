# Phase 3: Export Hardening + Web Deployment - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

DXF exports pass fabricator preflight with a visible validation report, the 3D preview tab survives switching on Safari, and the app is live at a public URL on Cloudflare Pages. No new export formats, no new panel features — hardening what exists and making it publicly accessible.

</domain>

<decisions>
## Implementation Decisions

### Preflight Validation UX
- Inline step before download — validation runs and results appear in the export panel as a pass/fail summary with expandable per-element details, then the download button
- Two severity levels: **critical** issues (open contours, missing definitions) block download; **minor** issues (hole-to-edge too close) show warning but allow download
- Summary + per-element breakdown: top-level pass/fail count, then expandable per-element results showing which specific cutout or hole failed and why
- Problem elements highlighted in **red** on the SVG front view so users can see WHERE the issue is

### Export Error Handling
- Missing device/connector definitions **block export** with a specific error naming the missing element(s) — no silent omission
- Preflight validation runs on **all export formats** (OpenSCAD, Fusion 360, DXF, JSON) — consistent behavior, not just DXF
- Validation messages include **actionable fix suggestions** (e.g., "Move BNC-1 at least 3.04mm from edge") with exact values needed

### Auto-Fix
- Claude's discretion on whether to include a "Fix All" button for minor spacing/margin issues in v1

### Deployment & Public Access
- Domain: **rackpro.prodro.pro** (subdomain of existing Cloudflare domain)
- CI/CD: Claude's discretion on Cloudflare Pages native Git integration vs GitHub Actions + Wrangler (pick simplest reliable approach)
- Update prompting: **Toast notification on next navigation** — service worker detects new version, shows "New version available — click to refresh" on next route change
- Offline support: **Basic offline via service worker** — cache app shell + catalog JSON, works offline after first visit
- Analytics: **Privacy-friendly analytics** — Cloudflare Web Analytics or similar (no cookies, GDPR compliant, page views + referrers only)
- Repo: **Make public for launch** — open source aligns with community contribution goals in Phase 6

### Claude's Discretion
- Safari WebGL fix implementation approach (CSS display:none vs conditional mount strategy)
- CI/CD pipeline choice (Cloudflare Pages Git integration vs GitHub Actions)
- Auto-fix button for minor validation issues
- Service worker caching strategy details
- Analytics provider selection (Cloudflare Web Analytics is the obvious choice given the hosting platform)

</decisions>

<specifics>
## Specific Ideas

- User has another project using GitHub Actions with webapp auto-check and update prompting — similar pattern desired here
- Validation report should feel trustworthy — "if this says pass, I can send the DXF to a fabricator with confidence"
- Red highlighting on SVG front view ties the text report to the visual canvas — users see problems in context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-export-hardening-web-deployment*
*Context gathered: 2026-02-22*
