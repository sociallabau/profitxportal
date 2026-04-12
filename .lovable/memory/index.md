# Project Memory

## Core
ProfitX: dark coaching portal for service-based businesses. BG #2b2b2b, card #333, purple accent #7F00FF. Inter font.
React + Supabase Cloud. Sidebar 240px sticky left, flex layout.
No sign-up flow — admin creates accounts only. Login-only auth page.
All routes protected. Admin routes for /admin/*, /submissions/*.

## Memories
- [Design system](mem://design/tokens) — Dark theme with purple, traffic light colors, pillar colors
- [Database schema](mem://features/schema) — profiles, roadmap_scores, weekly_wins, new_clients, monthly_totals, content_posts, saved_ideas
- [Page structure](mem://features/pages) — Login, Dashboard, Content Studio, Wins Wall, Cash Menu, Roadmap, Financials, Settings, Client Health (admin), Module pages
- [Security](mem://features/security) — ProtectedRoute wraps all routes, AdminRoute wraps admin routes, auth state listener in App.tsx
