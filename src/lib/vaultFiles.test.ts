import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { vaultFilesSource } from '../../scripts/vault-files';

describe('vault files for Dan AI', () => {
  it('the edge functions copy matches the Vault (run npx tsx scripts/vault-files.ts after editing it)', () => {
    expect(readFileSync('supabase/functions/_shared/vaultFiles.ts', 'utf8')).toBe(vaultFilesSource());
  });
});
