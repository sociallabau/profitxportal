UPDATE public.module_pages
SET sections = sections || '[
  {"type":"section_header","number":3,"label":"Setting Up Ads"},
  {"type":"video_embed","title":"Setting Up Ads — Part 1","url":"https://drive.google.com/file/d/1wyMr8Vj3tzvqKiF4C9d_AHeSSqsU8bx5/preview"},
  {"type":"video_embed","title":"Setting Up Ads — Part 2","url":"https://drive.google.com/file/d/1cLaMaHNvuzr8wbIRyg_yqQN-Qu0FMQlA/preview"},
  {"type":"video_embed","title":"Setting Up Ads — Part 3","url":"https://drive.google.com/file/d/1a5VcVS7xDOV0okXYQ11OjxGF2hJBmap8/preview"},
  {"type":"video_embed","title":"Setting Up Ads — Part 4","url":"https://drive.google.com/file/d/1bc_4oGzk4ulWrC9A6n6prGKQU6wlbvPr/preview"}
]'::jsonb,
updated_at = now()
WHERE module_id = 'C2';