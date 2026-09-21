import type { Database } from '@/integrations/supabase/types';

/**
 * Row types straight from the generated schema.
 *
 * Prefer these over `any` on anything that came out of Supabase: they are
 * regenerated with the database, so a column that gets renamed or dropped
 * shows up as a compile error rather than as undefined at runtime.
 *
 *   const rows: Row<'monthly_totals'>[] = data ?? [];
 */
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Insert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Update<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/** Views are read-only, so they only have a row shape. */
export type ViewRow<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
