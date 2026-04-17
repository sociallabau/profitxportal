-- Ad campaigns: one active per user (enforced via partial unique index)
CREATE TABLE public.ad_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | cancelled
  daily_budget NUMERIC NOT NULL DEFAULT 15,
  duration_days INTEGER NOT NULL DEFAULT 5,
  starting_followers INTEGER,
  current_followers INTEGER,
  ad_hook TEXT,
  offer_summary TEXT,
  notes TEXT,
  launched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_campaign_per_user
  ON public.ad_campaigns (user_id) WHERE status = 'active';

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_campaigns" ON public.ad_campaigns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_campaigns" ON public.ad_campaigns
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Followers being tracked & DM'd through the funnel
CREATE TABLE public.campaign_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  handle TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'new', -- new | qualified | dmd | replied | positive | booked | passed
  qualified BOOLEAN DEFAULT false,
  dm_history JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{role:'me'|'them', text, at}]
  notes TEXT,
  hot_list_id UUID, -- set when handed off
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_followers_campaign ON public.campaign_followers(campaign_id);
CREATE INDEX idx_campaign_followers_stage ON public.campaign_followers(user_id, stage);

ALTER TABLE public.campaign_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_followers" ON public.campaign_followers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_followers" ON public.campaign_followers
  FOR SELECT USING (public.is_admin(auth.uid()));

-- DM script templates (seeded defaults, admin-editable later)
CREATE TABLE public.dm_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_key TEXT NOT NULL UNIQUE, -- opener | follow_up | positive | objection_price | objection_think | booking
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_authenticated_read_templates" ON public.dm_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_templates" ON public.dm_templates
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ad_campaigns_updated BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_campaign_followers_updated BEFORE UPDATE ON public.campaign_followers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_dm_templates_updated BEFORE UPDATE ON public.dm_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default DM scripts
INSERT INTO public.dm_templates (stage_key, label, body, sort_order) VALUES
('opener', 'Opener (qualified follower)',
'Hey {handle} 👋 Appreciate the follow! Saw you''re in the {niche} space — what made you check out my page? Always curious what resonates with people 🙏',
1),
('follow_up', '3-day no-reply nudge',
'Hey {handle}, didn''t want this to get buried — genuinely curious what stood out from the page. No pitch, just keen to chat 🙌',
2),
('positive', 'Positive reply → soft pitch',
'Love that. Quick one — are you currently doing any short-form content for {business}? I help {niche} businesses turn their service into a content engine that actually books calls. Happy to share what''s working if useful?',
3),
('objection_price', 'Objection: "How much / too expensive"',
'Totally fair to ask. Investment depends on what you need — most of my clients are between £X-£Y/mo for full content + strategy. But before pricing, worth a quick 15min to see if we''re even a fit. Up for it this week?',
4),
('objection_think', 'Objection: "Let me think about it"',
'100% — take your time. Only thing I''d say: most people who "think about it" never circle back, and the algorithm doesn''t wait. Want me to send a 2-min Loom showing exactly what I''d do for {business}? Zero pressure either way.',
5),
('booking', 'Booking the call',
'Sweet 🙌 Easiest way is to grab a 15min slot here: [your-calendly-link]. Pick whatever works — I''ll send a quick brief beforehand so we don''t waste your time.',
6);