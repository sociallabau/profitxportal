import { describe, expect, it } from 'vitest';
import { bestRecording, recordingName } from '../../supabase/functions/ask-dan/recordings';
import { resourceCatalogue, resourceLink, vaultSources } from '@/data/resourceCatalogue';

const lines = resourceCatalogue().split('\n');
const payToPlay = lines.find(l => l.includes('Pay To Play'))!;
const adMetrics = lines.find(l => l.includes('Ad Metrics'))!;

describe('Dan AI recording links', () => {
  it('names a session without its category or date', () => {
    expect(recordingName(payToPlay)).toBe('pay to play');
    expect(recordingName('Vault · Momentum Call · Momentum Call (Aug 31)')).toBe('');
    expect(recordingName('Roadmap · growth · Hire Your First Editor — Remove yourself')).toBe('');
  });
  it('picks the recording whose Drive file or title the passages come from', () => {
    const [fileId] = Object.entries(vaultSources()).find(([, l]) => l === adMetrics)!;
    expect(bestRecording([{ title: 'random.mp4', source_id: fileId, score: 9 }], lines, vaultSources())).toBe(adMetrics);
    expect(bestRecording([{ title: 'Pay To Play Workshop - transcript', score: 5 }, { title: 'Call with Sam', score: 8 }], lines, vaultSources())).toBe(payToPlay);
    expect(bestRecording([{ title: 'Call with Sam', score: 8 }], lines, vaultSources())).toBeNull();
  });
  it('links a picked line to the recording, not just its category', () => {
    const r = resourceLink(payToPlay);
    expect(r.title).toBe('Workshop — Pay To Play™');
    expect(r.href).toMatch(/^https:\/\/drive\.google\.com/);
    expect(r.extras.length).toBeGreaterThan(0);
  });
});
