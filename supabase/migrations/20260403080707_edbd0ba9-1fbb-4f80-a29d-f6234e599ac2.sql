
-- Profiles table first
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text,
  tier text DEFAULT 'onramp' CHECK (tier IN ('onramp', 'growth', 'scale')),
  circle_url text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Now create admin check function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_admin = true)
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "admin_profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE public.roadmap_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  pillar text NOT NULL CHECK (pillar IN ('build', 'traffic', 'sales', 'scale')),
  module_number int NOT NULL CHECK (module_number BETWEEN 1 AND 6),
  score text DEFAULT 'red' CHECK (score IN ('red', 'amber', 'green')),
  notes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pillar, module_number)
);
ALTER TABLE public.roadmap_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_roadmap" ON public.roadmap_scores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_roadmap" ON public.roadmap_scores FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE public.weekly_wins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  win_text text NOT NULL,
  week_ending date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.weekly_wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_wins" ON public.weekly_wins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_wins" ON public.weekly_wins FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE public.new_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  monthly_value numeric NOT NULL,
  signed_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.new_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_clients" ON public.new_clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_clients" ON public.new_clients FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE public.monthly_totals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month date NOT NULL,
  mrr numeric DEFAULT 0,
  new_clients int DEFAULT 0,
  leads_generated int DEFAULT 0,
  content_posts int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);
ALTER TABLE public.monthly_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_monthly" ON public.monthly_totals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_monthly" ON public.monthly_totals FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE public.content_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content_type text,
  posted_at date NOT NULL,
  views int DEFAULT 0,
  likes int DEFAULT 0,
  leads int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_content" ON public.content_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_content" ON public.content_posts FOR SELECT USING (public.is_admin(auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
