REVOKE ALL ON TABLE public.context_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.context_rooms TO authenticated;
GRANT ALL ON TABLE public.context_rooms TO service_role;
REVOKE ALL ON FUNCTION public.save_context_section(uuid, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_context_section(uuid, text, jsonb, boolean) TO authenticated;