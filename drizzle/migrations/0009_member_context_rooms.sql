CREATE TABLE public.context_rooms (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 answers jsonb NOT NULL DEFAULT '{}'::jsonb,
 section_updated_at jsonb NOT NULL DEFAULT '{}'::jsonb,
 prefilled_by_admin boolean NOT NULL DEFAULT false,
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.context_rooms TO authenticated;
GRANT ALL ON public.context_rooms TO service_role;
ALTER TABLE public.context_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own room or admin" ON public.context_rooms FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Create own room or admin" ON public.context_rooms FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Update own room or admin" ON public.context_rooms FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER context_rooms_touch_updated_at BEFORE UPDATE ON public.context_rooms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.save_context_section(_user_id uuid, _section text, _answers jsonb, _admin_edit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF _section NOT IN ('about','numbers','customer','content','story','now','support') THEN RAISE EXCEPTION 'Invalid context section'; END IF;
 IF _admin_edit AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 INSERT INTO public.context_rooms (user_id, answers, section_updated_at, prefilled_by_admin)
 VALUES (_user_id, _answers, jsonb_build_object(_section, now()), _admin_edit)
 ON CONFLICT (user_id) DO UPDATE SET
 answers = public.context_rooms.answers || EXCLUDED.answers,
 section_updated_at = public.context_rooms.section_updated_at || EXCLUDED.section_updated_at,
 prefilled_by_admin = CASE WHEN _admin_edit THEN true ELSE public.context_rooms.prefilled_by_admin END,
 confirmed_at = CASE WHEN _admin_edit THEN NULL ELSE public.context_rooms.confirmed_at END;
END;
$$;
REVOKE ALL ON FUNCTION public.save_context_section(uuid, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_context_section(uuid, text, jsonb, boolean) TO authenticated;
COMMENT ON TABLE public.context_rooms IS 'Member-readable business context only. Never store private coach notes or risk ratings here. Exclude answers.anything_else from AI context.';