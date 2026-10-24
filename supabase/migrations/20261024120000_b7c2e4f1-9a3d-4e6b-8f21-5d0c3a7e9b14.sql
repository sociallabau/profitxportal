-- Playbooks: gate build lists, linked trainings, proof and admin approval.
--
-- playbook_gates          the four gates (Fix, Fuel, Scale, Supercharge) — admin-editable copy
-- playbook_gate_modules   which roadmap modules (O1…D6) belong to each gate
-- playbook_tasks          the build list for each gate — admin-editable
-- member_task_progress    a member's tick + proof per task (per month for monthly tasks)
-- member_playbook         per-member settings Dan controls: lead gen fast-track, extra modules
--
-- profiles.gate stays the source of truth for a member's current gate.

-- ---------- gates ----------
CREATE TABLE IF NOT EXISTS public.playbook_gates (
  gate smallint PRIMARY KEY CHECK (gate BETWEEN 1 AND 4),
  name text NOT NULL,
  headline text NOT NULL,
  focus text NOT NULL DEFAULT '',
  what_you_get text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- modules per gate ----------
CREATE TABLE IF NOT EXISTS public.playbook_gate_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate smallint NOT NULL REFERENCES public.playbook_gates(gate) ON DELETE CASCADE,
  module_code text NOT NULL,
  note text,
  position smallint NOT NULL DEFAULT 0,
  UNIQUE (gate, module_code)
);

-- ---------- build tasks ----------
CREATE TABLE IF NOT EXISTS public.playbook_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate smallint NOT NULL REFERENCES public.playbook_gates(gate) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  title text NOT NULL,
  why text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'once' CHECK (kind IN ('kickoff', 'once', 'monthly')),
  module_codes text[] NOT NULL DEFAULT '{}',
  training_label text,
  training_url text,
  proof_hint text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS playbook_tasks_gate_idx ON public.playbook_tasks (gate, position);

-- ---------- member progress ----------
-- period = 'once' for once/kickoff tasks, 'YYYY-MM' for monthly tasks.
CREATE TABLE IF NOT EXISTS public.member_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.playbook_tasks(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT 'once' CHECK (period = 'once' OR period ~ '^\d{4}-\d{2}$'),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'needs_changes')),
  proof_url text,
  member_note text,
  review_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (user_id, task_id, period)
);
CREATE INDEX IF NOT EXISTS member_task_progress_user_idx ON public.member_task_progress (user_id);
CREATE INDEX IF NOT EXISTS member_task_progress_status_idx ON public.member_task_progress (status);

-- ---------- member settings (Dan controls) ----------
CREATE TABLE IF NOT EXISTS public.member_playbook (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  fast_track_lead_gen boolean NOT NULL DEFAULT false,
  fast_track_since date,
  extra_modules text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- ---------- RLS ----------
ALTER TABLE public.playbook_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_gate_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_playbook ENABLE ROW LEVEL SECURITY;

-- Playbook content: every signed-in member reads it, only admins change it.
DROP POLICY IF EXISTS playbook_gates_read ON public.playbook_gates;
CREATE POLICY playbook_gates_read ON public.playbook_gates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS playbook_gates_admin ON public.playbook_gates;
CREATE POLICY playbook_gates_admin ON public.playbook_gates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS playbook_gate_modules_read ON public.playbook_gate_modules;
CREATE POLICY playbook_gate_modules_read ON public.playbook_gate_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS playbook_gate_modules_admin ON public.playbook_gate_modules;
CREATE POLICY playbook_gate_modules_admin ON public.playbook_gate_modules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS playbook_tasks_read ON public.playbook_tasks;
CREATE POLICY playbook_tasks_read ON public.playbook_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS playbook_tasks_admin ON public.playbook_tasks;
CREATE POLICY playbook_tasks_admin ON public.playbook_tasks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Progress: members see and submit their own; admins see and review everyone's.
DROP POLICY IF EXISTS member_task_progress_own_read ON public.member_task_progress;
CREATE POLICY member_task_progress_own_read ON public.member_task_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS member_task_progress_own_insert ON public.member_task_progress;
CREATE POLICY member_task_progress_own_insert ON public.member_task_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS member_task_progress_own_update ON public.member_task_progress;
CREATE POLICY member_task_progress_own_update ON public.member_task_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS member_task_progress_admin_delete ON public.member_task_progress;
CREATE POLICY member_task_progress_admin_delete ON public.member_task_progress FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Member settings: members read their own, only admins write.
DROP POLICY IF EXISTS member_playbook_read ON public.member_playbook;
CREATE POLICY member_playbook_read ON public.member_playbook FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS member_playbook_admin ON public.member_playbook;
CREATE POLICY member_playbook_admin ON public.member_playbook FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- guards ----------
-- Members can only ever submit: they can't approve themselves, can't touch review
-- fields, and can't edit a task once Dan has approved it. Kickoff tasks are Dan's to tick.
CREATE OR REPLACE FUNCTION public.guard_member_task_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_kind text;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT kind INTO task_kind FROM public.playbook_tasks WHERE id = NEW.task_id;
  IF task_kind = 'kickoff' THEN
    RAISE EXCEPTION 'Kickoff tasks are ticked off by Dan';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RAISE EXCEPTION 'This task is already approved';
  END IF;

  NEW.status := 'submitted';
  NEW.submitted_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.review_note := OLD.review_note;
  ELSE
    NEW.review_note := NULL;
  END IF;
  NEW.reviewed_at := NULL;
  NEW.reviewed_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_member_task_progress ON public.member_task_progress;
CREATE TRIGGER trg_guard_member_task_progress
  BEFORE INSERT OR UPDATE ON public.member_task_progress
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_task_progress();

-- Only admins set a member's gate. A separate trigger, so the existing
-- prevent_profile_privilege_escalation function is left exactly as it is.
CREATE OR REPLACE FUNCTION public.prevent_member_gate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_admin(auth.uid()) THEN
    NEW.gate := OLD.gate;
    NEW.gate_key_task := OLD.gate_key_task;
    NEW.gate_move_up := OLD.gate_move_up;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_gate_change ON public.profiles;
CREATE TRIGGER trg_prevent_member_gate_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_gate_change();

REVOKE ALL ON FUNCTION public.guard_member_task_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_member_gate_change() FROM PUBLIC, anon, authenticated;

-- ---------- seed ----------
INSERT INTO public.playbook_gates (gate, name, headline, focus, what_you_get) VALUES
  (1, 'Fix', '3 paying retainers', 'Offer · Proof · Sales', 'The offer sells'),
  (2, 'Fuel', '1 new client every month', 'Content · Conversations · Tracking', 'Demand on purpose'),
  (3, 'Scale', '2 new clients every month', 'Leads · Follow-up · Hub', 'Demand as a system'),
  (4, 'Supercharge', '4 inbound a month', 'Systems · Reporting · Retention', 'Demand comes to you')
ON CONFLICT (gate) DO NOTHING;

INSERT INTO public.playbook_gate_modules (gate, module_code, note, position) VALUES
  (1, 'O1', NULL, 1), (1, 'O2', NULL, 2), (1, 'O3', NULL, 3),
  (1, 'C1', NULL, 4), (1, 'C2', 'Level 1: $50 profile-visit boost on every post', 5), (1, 'C3', NULL, 6),
  (1, 'D1', NULL, 7), (1, 'D2', NULL, 8),
  (2, 'C1', 'Your monthly content plan and case studies', 1),
  (2, 'C2', 'Level 2: your always-on awareness campaign', 2),
  (2, 'D3', NULL, 3),
  (3, 'C4', NULL, 1), (3, 'O6', NULL, 2), (3, 'D4', NULL, 3),
  (4, 'O4', NULL, 1), (4, 'O5', NULL, 2), (4, 'C5', NULL, 3),
  (4, 'C6', NULL, 4), (4, 'D5', NULL, 5), (4, 'D6', NULL, 6)
ON CONFLICT (gate, module_code) DO NOTHING;

-- Seed tasks only on a fresh install, so re-running never duplicates them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.playbook_tasks) THEN
    INSERT INTO public.playbook_tasks (gate, position, kind, title, why, module_codes, training_label, proof_hint) VALUES
      -- Gate 1: Fix
      (1, 1, 'kickoff', 'Golden Retainer, tiers, proposal doc and sales meeting flow',
        'We build these together on your kickoff call. It''s what you sell.', '{O2,O3,C3}', NULL,
        'Dan ticks this off after your kickoff call'),
      (1, 2, 'once', 'Set up your profile to sell the retainer',
        'Every post and boost sends people to your profile, so it needs to sell.', '{O1}', NULL,
        'Link to your Instagram profile'),
      (1, 3, 'monthly', 'Post 4 BTS videos on your Instagram and put a $50 profile-visit boost behind each',
        '4 posts a month is the Gate 1 bar, and the boost gets them in front of local businesses.', '{C1,C2}', NULL,
        'Post links + an Ads Manager screenshot'),
      (1, 4, 'monthly', 'Have 4 retainer conversations (1 a week) and log them in your Hot List',
        'Gate 1 needs 4 conversations a month. DM the people who engage with each post.', '{}', 'Hot List walkthrough',
        'Logged in your Hot List'),
      -- Gate 2: Fuel
      (2, 1, 'once', 'Get your awareness profile-visit campaign live',
        'Gate 2 is where your best posts start running all month, every month.', '{C2}', NULL,
        'Ads Manager screenshot'),
      (2, 2, 'monthly', 'Map out your content plan for the month, mostly BTS posts',
        'A plan means you post consistently instead of scrambling.', '{C1}', NULL,
        'Link to your plan'),
      (2, 3, 'monthly', 'Post 8 times on your own Instagram (2 a week) and add your best ones to awareness',
        '8 posts a month on your own account is the Gate 2 bar.', '{C1}', NULL,
        'Post links'),
      (2, 4, 'monthly', 'Have 6 retainer conversations using the DM scripts and log them in your Hot List',
        'Gate 2 needs 6 retainer conversations a month.', '{}', 'DM scripts',
        'Logged in your Hot List'),
      (2, 5, 'monthly', 'Post 1 case study: a BTS post, a client result or an on-camera testimonial',
        'You need 4 case studies to clear Gate 2. Dan signs each one off.', '{C1}', NULL,
        'Send the link'),
      (2, 6, 'once', 'Line up editing help',
        'Frees you up to keep posting and closing as clients stack up.', '{D3}', NULL,
        'Send an edit from your editor'),
      -- Gate 3: Scale
      (3, 1, 'once', 'Get your lead gen campaign live ($20/day+)',
        'Gate 3 is where leads come in on purpose, every week.', '{C4}', NULL,
        'Ads Manager screenshot'),
      (3, 2, 'once', 'Build your growth hub, with a speed-to-lead section',
        'Every lead, how fast you reply and what converts, all in one place.', '{}', 'Growth hub walkthrough',
        'Screenshot showing your speed-to-lead section'),
      (3, 3, 'monthly', 'Call every lead within 15–30 mins and update your ad tracking sheet weekly',
        'Speed to lead wins deals that are already half won.', '{C4}', NULL,
        'Growth hub screenshot'),
      (3, 4, 'once', 'Build your individual client P&L and business capacity',
        'Know what each client actually makes you and how many more you can take on.', '{O6,D4}', NULL,
        'Sheet link'),
      -- Gate 4: Supercharge (draft — Dan to finalise)
      (4, 1, 'once', 'Set up your Airtable client tracking hub',
        'One place to see every client, their results and their renewals.', '{}', 'Airtable hub walkthrough',
        'Screenshot'),
      (4, 2, 'once', 'Build your monthly client reporting table and AI reporting bot',
        'Clients see their results every month without you building reports by hand.', '{}', 'Reporting + AI bot walkthrough',
        'Screenshot'),
      (4, 3, 'once', 'Write your delivery SOPs',
        'Your team delivers the same quality without you in every job.', '{D5}', NULL,
        'Doc link'),
      (4, 4, 'monthly', 'Track churn and take one retention action',
        'Churn at or under 10% a year is part of the Gate 4 bar.', '{C6}', NULL,
        'Tell Dan what you did');
  END IF;
END $$;

-- ---------- member memory ----------
-- Dan AI's running picture of each member, rewritten by ask-dan (Sonnet) from
-- everything in the portal. Any change to a member's data marks it dirty;
-- ask-dan refreshes it after their next question and every 2 days via cron.
-- Admin-read only: members never see the memory itself, only better answers.
CREATE TABLE IF NOT EXISTS public.member_memory (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  dirty_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz,
  refresh_started_at timestamptz,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Their own recent Instagram posts, pulled at most daily via Apify.
  instagram jsonb,
  instagram_handle text,
  instagram_fetched_at timestamptz,
  -- Member-facing "your next move" line, written with the memory. Nothing private.
  brief text
);
CREATE INDEX IF NOT EXISTS member_memory_dirty_idx ON public.member_memory (dirty_at);

ALTER TABLE public.member_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_memory_admin_read ON public.member_memory;
CREATE POLICY member_memory_admin_read ON public.member_memory FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Members read only their own brief, never the memory behind it.
CREATE OR REPLACE FUNCTION public.my_dan_brief()
RETURNS TABLE (brief text, refreshed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.brief, m.refreshed_at FROM public.member_memory m WHERE m.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_dan_brief() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_dan_brief() TO authenticated;

-- TG_ARGV[0] names the column that holds the member's id on the source table.
CREATE OR REPLACE FUNCTION public.mark_member_memory_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member uuid;
  rec jsonb;
BEGIN
  rec := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  member := NULLIF(rec ->> TG_ARGV[0], '')::uuid;
  -- Members only: admins (Dan, Emily) asking Dan AI shouldn't build a memory of themselves.
  IF member IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = member AND NOT coalesce(is_admin, false)) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.member_memory (user_id, dirty_at) VALUES (member, now())
  ON CONFLICT (user_id) DO UPDATE SET dirty_at = now();
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_member_memory_dirty() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('profiles', 'id'), ('context_rooms', 'user_id'), ('monthly_totals', 'user_id'), ('goals', 'user_id'),
    ('member_task_progress', 'user_id'), ('member_playbook', 'user_id'), ('new_clients', 'user_id'),
    ('hot_list', 'user_id'), ('weekly_wins', 'user_id'), ('monday_wins', 'user_id'),
    ('roadmap_audits', 'user_id'), ('roadmap_scores', 'user_id'), ('monthly_reviews', 'user_id'),
    ('client_notes', 'client_id'), ('client_health', 'client_user_id'), ('client_questions', 'user_id'),
    ('content_posts', 'user_id'), ('ad_campaigns', 'user_id'), ('financial_audits', 'user_id'),
    ('cash_menu_actions', 'user_id')
  ) AS v(tbl, col)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_member_memory_dirty ON public.%I', t.tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_member_memory_dirty AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.mark_member_memory_dirty(%L)', t.tbl, t.col);
    END IF;
  END LOOP;
END $$;

-- Every member starts with a memory to build.
INSERT INTO public.member_memory (user_id)
SELECT id FROM public.profiles WHERE NOT coalesce(is_admin, false)
ON CONFLICT (user_id) DO NOTHING;

-- Scheduled jobs: Drive sync (every 30 min), transcription (hourly) and the
-- member memory rebuild (every 2 days, in 6 hourly batches of 15 so no single
-- call runs long; Instagram is re-pulled at most every 2 days inside it). All read app.settings.supabase_url,
-- app.settings.cron_secret and app.settings.anon_key. The anon key (public)
-- gets the call past the functions gateway; each function only acts on a
-- matching CRON_SECRET. Re-registering the two existing jobs adds that header.
DO $$
DECLARE
  job record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  FOR job IN SELECT * FROM (VALUES
    ('dan-ai-drive-sync', '*/30 * * * *', 'drive-sync', '{}'),
    ('dan-ai-transcribe', '15 * * * *', 'transcribe', '{"limit": 3}'),
    ('dan-ai-member-memory', '40 3-8 */2 * *', 'ask-dan', '{"limit": 15}')
  ) AS v(name, schedule, fn, body)
  LOOP
    PERFORM cron.unschedule(job.name) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = job.name);
    PERFORM cron.schedule(job.name, job.schedule, format($cmd$
      select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/%s',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.anon_key'),
          'x-cron-secret', current_setting('app.settings.cron_secret')
        ),
        body := %L::jsonb
      );
    $cmd$, job.fn, job.body));
  END LOOP;
END $$;
