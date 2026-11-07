-- The portal runs on a three-month cycle (December reflects, January builds, February
-- implements, then it repeats — see src/lib/cycle.ts). In the reflect month a member retakes
-- their roadmap audit and picks two projects for the cycle: one to grow the business, one to
-- tighten it up. Those picks live on the audit row, so each cycle keeps its own record and the
-- next review can ask whether the last two actually shipped.
--
-- A row per review, as before: no unique key, newest by created_at wins.

ALTER TABLE public.roadmap_audits
  -- 'YYYY-MM' of the cycle's reflect month, so all three months of a cycle share one key.
  ADD COLUMN IF NOT EXISTS cycle_key text,
  -- Roadmap module codes (O1–O6, C1–C6, D1–D6).
  ADD COLUMN IF NOT EXISTS bigger_code text,
  ADD COLUMN IF NOT EXISTS better_code text;

CREATE INDEX IF NOT EXISTS roadmap_audits_user_cycle_idx
  ON public.roadmap_audits (user_id, cycle_key);
