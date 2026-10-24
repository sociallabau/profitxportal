/**
 * Picks the Vault recording that best covers a question, from the Drive
 * transcripts retrieval just pulled. A passage counts for a recording when its
 * doc is that recording's Drive file, its title names the session
 * ("Pay To Play"), or its title carries the session's date
 * ("Momentum Call™ - 2026/09/15" -> the Vault's "(Sep 15)" call).
 */

type Passage = { title: string; source_id?: string | null; score: number };

const norm = (s: string) => s.toLowerCase().replace(/[™®]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** "Vault · Workshop · Workshop — Pay To Play™ (Jul 22)" -> "pay to play". Empty for generic titles. */
export function recordingName(line: string): string {
  if (!line.startsWith("Vault · ")) return "";
  const title = (line.split(" · ").pop() ?? "").replace(/\s*\([^)]*\)\s*$/, "");
  const name = title.replace(/^(Workshop|Lesson|Momentum Call|Hot Seat|Q&A)\s*[—–-]\s*/i, "");
  if (name === title && /^(Momentum Call|Q&A)$/i.test(title.trim())) return "";
  const n = norm(name);
  return n.length >= 5 ? n : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "ProfitX - Momentum Call™ - 2026/09/15 07:29 AEST – Recording" -> "Sep 15". */
export function titleDate(title: string): string | null {
  const m = title.match(/\b20\d\d[/-](\d{1,2})[/-](\d{1,2})\b/);
  return m && MONTHS[Number(m[1]) - 1] ? `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}` : null;
}

/** The "(Sep 15)" on a Vault catalogue line. */
const lineDate = (line: string) => line.startsWith("Vault · ") ? line.match(/\(([A-Z][a-z]{2} \d{1,2})\)$/)?.[1] ?? null : null;

export function bestRecording(passages: Passage[], catalogueLines: string[], sources: Record<string, string>): string | null {
  const vault = catalogueLines.map(line => ({ line, name: recordingName(line), date: lineDate(line) })).filter(v => v.name || v.date);
  const totals = new Map<string, number>();
  for (const p of passages) {
    const byFile = p.source_id ? sources[p.source_id] : undefined;
    const title = ` ${norm(p.title)} `;
    const date = titleDate(p.title);
    const line = byFile && catalogueLines.includes(byFile) ? byFile
      : vault.find(v => v.name && title.includes(` ${v.name} `))?.line ?? (date ? vault.find(v => v.date === date)?.line : undefined);
    if (line) totals.set(line, (totals.get(line) ?? 0) + Math.max(1, p.score));
  }
  // Prefer workshops and lessons over calls when they tie.
  const weight = (line: string) => (totals.get(line) ?? 0) * (/^Vault · (Workshop|Lesson) ·/.test(line) ? 1.25 : 1);
  return [...totals.keys()].sort((a, b) => weight(b) - weight(a))[0] ?? null;
}
