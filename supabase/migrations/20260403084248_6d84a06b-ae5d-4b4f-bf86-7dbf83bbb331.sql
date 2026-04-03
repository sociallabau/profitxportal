ALTER TABLE public.monthly_totals
  ADD COLUMN oneoff_revenue numeric DEFAULT 0,
  ADD COLUMN expenses numeric DEFAULT 0;