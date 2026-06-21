UPDATE module_pages
SET sections = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' = 'paragraph' AND elem->>'text' LIKE 'Frameworks and templates%'
      THEN jsonb_set(elem, '{text}', '"Additional resources to help"'::jsonb)
      WHEN elem->>'type' = 'video_embed' AND elem->>'url' LIKE '%drive.google.com%'
      THEN jsonb_set(elem, '{poster}', '"module-cover-stupidly-simple-ad"'::jsonb)
      ELSE elem 
    END
  )
  FROM jsonb_array_elements(sections) elem
)
WHERE module_id = 'C2';