-- The reflect month's review (see src/lib/cycle.ts). The numbers half is computed from their
-- own check-ins, so the only things asked are the ones the data cannot answer: what actually
-- moved the needle, what stalled and why, what they are deliberately not doing next cycle,
-- and how confident they feel across the four areas of the business.
--
-- Lives on the audit row so one cycle review is one record, alongside its cycle_key and the
-- two projects picked. Dan AI reads these, so a thin answer here is a thin recommendation.

ALTER TABLE public.roadmap_audits
  ADD COLUMN IF NOT EXISTS moved_needle text,
  ADD COLUMN IF NOT EXISTS stalled text,
  ADD COLUMN IF NOT EXISTS not_doing text,
  -- 1-10 self-scores, the same four areas as the Gate 1 build list: offer, content,
  -- conversations, delivery. Asked once a cycle; monthly_totals.business_confidence stays
  -- the overall monthly number.
  ADD COLUMN IF NOT EXISTS confidence_offer smallint,
  ADD COLUMN IF NOT EXISTS confidence_content smallint,
  ADD COLUMN IF NOT EXISTS confidence_conversations smallint,
  ADD COLUMN IF NOT EXISTS confidence_delivery smallint;

ALTER TABLE public.roadmap_audits
  ADD CONSTRAINT roadmap_audits_confidence_range_chk
  CHECK (
    (confidence_offer IS NULL OR confidence_offer BETWEEN 1 AND 10)
    AND (confidence_content IS NULL OR confidence_content BETWEEN 1 AND 10)
    AND (confidence_conversations IS NULL OR confidence_conversations BETWEEN 1 AND 10)
    AND (confidence_delivery IS NULL OR confidence_delivery BETWEEN 1 AND 10)
  );
