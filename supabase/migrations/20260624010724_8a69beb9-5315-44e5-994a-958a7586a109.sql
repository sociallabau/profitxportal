
INSERT INTO public.module_pages (module_id, pillar, title, subtitle, sections)
VALUES (
  'D2',
  'delivery',
  'Onboarding Blueprint',
  'How to onboard new clients smoothly and run a strategy session that builds trust, gets results, and sets up every shoot with clarity.',
  '[
    {"type":"video_embed","title":"Main Recording","url":"https://drive.google.com/file/d/1gL1dwbaRYRkPNfKGwUGLKB4MQtLMlj4G/preview"},
    {"type":"section_header","number":2,"label":"Resources"},
    {"type":"paragraph","text":"Everything you need to run the Onboarding Blueprint with your clients."},
    {"type":"link_placeholder","label":"Summary","url":"https://docs.google.com/document/d/1BnNkY-G22_N2dOBXi-T-9YRwIUqA1Gqypi0kO_qKFI8/edit?usp=sharing"},
    {"type":"link_placeholder","label":"Completed Workbook","url":"https://drive.google.com/file/d/1sVIsKqFUE5L1zVDsZ2rBPV-8KhnZ9yOU/view?usp=sharing"},
    {"type":"link_placeholder","label":"Strategy Session GPT","url":"https://chatgpt.com/g/g-6a30873896388191b5615dc3b54654c0-content-strategy-mapper"},
    {"type":"link_placeholder","label":"Strategy Docs","url":"https://drive.google.com/file/d/16DKdMrjx50p-kAeMq_HRvkjIuEOU1WqT/view?usp=sharing"},
    {"type":"link_placeholder","label":"Strategy Docs (Additional)","url":"https://drive.google.com/file/d/1RGCEt4gyCAq5frcEJZHdGQvpPSjkF6EV/view?usp=sharing"}
  ]'::jsonb
)
ON CONFLICT (module_id) DO UPDATE SET
  pillar = EXCLUDED.pillar,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  sections = EXCLUDED.sections,
  updated_at = now();
