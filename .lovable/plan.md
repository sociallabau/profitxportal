# New Roadmap Restructure

## 1. Tier system — 2 access levels

Replace `onramp / growth / scale` with two access levels stored in `profiles.tier`:

- **`starter`** → unlocks Stage 1: $0–20k/mth (modules in rows 1–3: O1–O3, C1–C3, D1–D3)
- **`scale`** → unlocks everything (Stage 1 + Stage 2: $30–84k/mth, rows 4–6)

Existing values (`onramp`, `growth`) will be treated as `starter`; existing `scale` stays `scale`. No DB migration needed (the column is free text).

## 2. Onboarding — capture starting revenue

Add a new step to `OnboardingModal` asking **"What is your current monthly revenue?"** with options:
- `Under $20k/mth` → set `tier = 'starter'`
- `$20k+/mth` → set `tier = 'scale'`

Admins can still change a user's tier from the backend / settings as today.

## 3. Roadmap page

- Promote **ProfitX Roadmap** (the O/C/D grid) to be the **primary** view.
- Remove the "Coming Soon" badge from it.
- Remove the on-ramp / growth / scale tier indicators and per-pillar tab UI from the top of the page.
- Replace with two stage indicators: **$0–20k/mth** and **$30–84k/mth**, showing locked state + per-stage progress (X/9 modules).
- Each module card becomes a clickable button that navigates to `/module/{code}` (e.g. `/module/C2`).
- Stage 2 cards are locked (with lock icon, greyed) for `starter` users.
- Completion state continues to use the existing `checklist_progress` table with `task_key = module code` (e.g. `C2`).
- Legacy pillar roadmap stays exactly as-is inside the collapsible "Legacy Modules" section.

## 4. Module page (`/module/:moduleId`)

The existing `ModulePage.tsx` already supports `video_embed` and link resources via JSON sections — no code changes needed. We just seed `module_pages` rows for the new ProfitX modules as they get content.

For C2 specifically, seed a row with:
- **Title:** Stupidly Simple Ad
- **Pillar:** traffic (green)
- **Sections:**
  1. `video_embed` — embedded Google Drive video (uses `https://drive.google.com/file/d/1UxGlZBhz1T54le5w1FV0qdzGUoyVXtN8/preview` in an iframe)
  2. `section_header` — "Resources"
  3. `link_placeholder` — Heavy VSL Type Framework (Notion link)
  4. `link_placeholder` — Ongoing Profile Visit Ads Frameworks (Notion link)

### Small code tweak

`video_embed` currently only auto-embeds Loom URLs. I'll extend it to also convert Google Drive `…/view` URLs to `…/preview` so the iframe renders correctly.

## 5. Technical details

- File edits:
  - `src/pages/Roadmap.tsx` — new stage indicators, clickable ProfitX grid, remove old tier UI.
  - `src/components/OnboardingModal.tsx` — add revenue step, write `tier` to profile.
  - `src/pages/ModulePage.tsx` — add Google Drive embed support in `video_embed`.
- DB: insert one `module_pages` row for `module_id = 'C2'` via the data tool (no schema change).
- Helper `getTierUnlocked` updated to handle `starter | scale`.

## Out of scope (for now)

- Seeding the other 17 module pages — they'll show the existing "This module page has not been created yet" placeholder until you send content.
- Changing the legacy modules.
