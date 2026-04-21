UPDATE module_pages
SET sections = '[
  {"type": "section_header", "label": "MASTERCLASS", "number": 1},
  {"text": "5 Ps Content Masterclass", "type": "heading"},
  {"text": "Watch the complete masterclass to learn the 5 Ps Framework for creating content that consistently generates leads for your business.", "type": "paragraph"},
  {"type": "link_placeholder", "label": "Watch Video Masterclass", "url": "https://fathom.video/share/DcMunbGJxo_LVJ3kUveZHXqCgCm7UsTc"},
  {"type": "section_header", "label": "WORKBOOKS", "number": 2},
  {"text": "Workshop Resources & Workbooks", "type": "heading"},
  {"text": "Download the workbooks and follow along with the masterclass to implement the 5 Ps Framework for your business.", "type": "paragraph"},
  {"type": "link_placeholder", "label": "Open Notion Workbooks", "url": "https://messy-arrow-f59.notion.site/Traffic-Engine-Workshop-Resources-32dbdcf32ce480e0abd8fa3e9b587b67?source=copy_link"},
  {"text": "Complete the workbooks while watching the masterclass for maximum retention and implementation.", "type": "pro_tip"}
]'::jsonb
WHERE module_id = '5ps-framework';