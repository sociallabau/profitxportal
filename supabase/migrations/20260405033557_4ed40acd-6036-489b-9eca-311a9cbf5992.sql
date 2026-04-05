
-- 1. Extend monthly_totals with new fields (using triggers instead of CHECK constraints)
ALTER TABLE public.monthly_totals
  ADD COLUMN IF NOT EXISTS business_confidence int,
  ADD COLUMN IF NOT EXISTS biggest_win text,
  ADD COLUMN IF NOT EXISTS needs_this_month text,
  ADD COLUMN IF NOT EXISTS nps int,
  ADD COLUMN IF NOT EXISTS offers_made int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booked_calls int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calls_showed int DEFAULT 0;

-- Validation trigger for business_confidence (1-10)
CREATE OR REPLACE FUNCTION public.validate_monthly_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_confidence IS NOT NULL AND (NEW.business_confidence < 1 OR NEW.business_confidence > 10) THEN
    RAISE EXCEPTION 'business_confidence must be between 1 and 10';
  END IF;
  IF NEW.nps IS NOT NULL AND (NEW.nps < 1 OR NEW.nps > 10) THEN
    RAISE EXCEPTION 'nps must be between 1 and 10';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_monthly_totals_trigger
  BEFORE INSERT OR UPDATE ON public.monthly_totals
  FOR EACH ROW EXECUTE FUNCTION public.validate_monthly_totals();

-- 2. Monday Wins table
CREATE TABLE IF NOT EXISTS public.monday_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  win_text text NOT NULL,
  new_client boolean DEFAULT false,
  cash_collected numeric(10,2) DEFAULT 0,
  deal_value numeric(10,2) DEFAULT 0,
  occurred_on date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.monday_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own monday wins"
  ON public.monday_wins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All authenticated users read monday wins"
  ON public.monday_wins FOR SELECT
  TO authenticated
  USING (true);

-- 3. Client health table
CREATE TABLE IF NOT EXISTS public.client_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL UNIQUE,
  health_status text DEFAULT 'amber',
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger for health_status
CREATE OR REPLACE FUNCTION public.validate_client_health()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.health_status NOT IN ('green', 'amber', 'red') THEN
    RAISE EXCEPTION 'health_status must be green, amber, or red';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_client_health_trigger
  BEFORE INSERT OR UPDATE ON public.client_health
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_health();

ALTER TABLE public.client_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client health"
  ON public.client_health FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users read own health status"
  ON public.client_health FOR SELECT
  USING (client_user_id = auth.uid());

-- 4. Admin overview view
CREATE OR REPLACE VIEW public.admin_client_overview AS
SELECT
  p.id,
  p.full_name,
  p.tier,
  p.is_admin,
  mt.month AS last_submission_month,
  mt.nps AS last_nps,
  mt.business_confidence AS last_confidence,
  mt.biggest_win AS last_biggest_win,
  mt.needs_this_month AS last_needs,
  mt.mrr AS last_mrr,
  mt.created_at AS last_submission_at,
  EXTRACT(days FROM now() - mt.created_at)::int AS days_since_submission,
  mw.created_at AS last_monday_win_at,
  EXTRACT(days FROM now() - mw.created_at)::int AS days_since_monday_win,
  ch.health_status AS manual_status,
  ch.notes AS health_notes
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT * FROM public.monthly_totals
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) mt ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.monday_wins
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) mw ON true
LEFT JOIN public.client_health ch ON ch.client_user_id = p.id
WHERE (p.is_admin IS NULL OR p.is_admin = false);
