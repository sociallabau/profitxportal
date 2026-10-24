-- Monthly Check-In boxes that line up with the gates: retainer conversations and
-- ad leads apart (they used to share "Convos / Leads"), active and lost retainers,
-- case studies posted, and ad spend split into awareness and lead gen.
-- leads_generated and ad_spend stay filled as the combined totals.
ALTER TABLE public.monthly_totals
  ADD COLUMN IF NOT EXISTS active_retainers integer,
  ADD COLUMN IF NOT EXISTS retainers_lost integer,
  ADD COLUMN IF NOT EXISTS retainer_convos integer,
  ADD COLUMN IF NOT EXISTS ad_leads integer,
  ADD COLUMN IF NOT EXISTS case_studies_posted integer,
  ADD COLUMN IF NOT EXISTS ad_spend_awareness numeric,
  ADD COLUMN IF NOT EXISTS ad_spend_leadgen numeric;
