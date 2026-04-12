
-- Add business_overview to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_overview text;

-- Add missing columns to content_posts for Content Calendar
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS post_type text;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS hook text;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS script text;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS status text DEFAULT 'idea';
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Create saved_ideas table
CREATE TABLE public.saved_ideas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source_handle text,
  source_thumbnail_url text,
  source_caption text,
  outlier_score numeric,
  is_boosted boolean DEFAULT false,
  ai_script text,
  saved_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.saved_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved ideas"
ON public.saved_ideas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved ideas"
ON public.saved_ideas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved ideas"
ON public.saved_ideas FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all saved ideas"
ON public.saved_ideas FOR SELECT
USING (public.is_admin(auth.uid()));
