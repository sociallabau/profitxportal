INSERT INTO public.module_pages (module_id, title, pillar, sections)
VALUES (
  'C1',
  '5 Ps Framework',
  'traffic',
  '[
    {"type":"video_embed","title":"5 Ps Framework","url":"https://drive.google.com/file/d/1WElGNTxmpdiRTP-mx1XKD6zByGBXqyT5/preview","poster":"module-cover-5ps-framework"},
    {"type":"section_header","number":2,"label":"Resources"},
    {"type":"paragraph","text":"Additional resources to help"},
    {"type":"link_placeholder","label":"Story Sequence Frameworks","url":"https://messy-arrow-f59.notion.site/Story-Sequence-Strategy-4f4bdcf32ce48226812f81073b03de51?source=copy_link"},
    {"type":"link_placeholder","label":"Traffic Engine Masterclass","url":"https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc"},
    {"type":"link_placeholder","label":"Masterclass Workbook & Templates","url":"https://messy-arrow-f59.notion.site/Traffic-Engine-Workshop-Resources-32dbdcf32ce480e0abd8fa3e9b587b67?source=copy_link"}
  ]'::jsonb
)
ON CONFLICT (module_id) DO UPDATE SET
  title = EXCLUDED.title,
  pillar = EXCLUDED.pillar,
  sections = EXCLUDED.sections,
  updated_at = now();