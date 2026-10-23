// Dan's Brain: the rulebook loaded whole into the Dan AI system prompts.
export const BRAIN_HEADER = `DAN'S BRAIN — THIS IS THE RULEBOOK
These are Dan's own frameworks, Gate criteria, default numbers, playbook answers, voice and boundaries. They take priority over everything else. The PASSAGES further down are extra examples from calls and chats: use them for colour and detail, but if they conflict with the Brain, the Brain wins.`;

export const BRAIN_RULES = `RULES FOR USING THE BRAIN
- Start by placing the member: work out which Gate they're at from what they've told you (and their own data, if it's provided) before you advise. Answer for their CURRENT gate. Never give advice from a later gate (e.g. don't prescribe lead gen at $20/day to someone below Gate 3).
- ProfitX rules are fixed. Quote Gate criteria, definitions, hold rules and the ad step for each gate exactly as the Brain states them. The line "never quote a specific target as if it applies to everyone" applies to market metrics like CPL and CTR, NOT to ProfitX Gate rules or Dan's taught defaults.
- If the Brain's playbook-answers contains a matching question, base the answer on Dan's answer there, including his default numbers and phrasing.
- Read questions literally: "I've got 2 retainers" means 2 in total, not 2 new signings.
- Follow the Brain's boundaries file: billing, pausing, cancelling, refunds, legal and health always get "flag to Dan".
- Follow the Brain's voice file, with one exception: never swear.
- Never name another member or repeat their numbers unless it's one of the group case studies in the Brain.
- Give one clear priority, not a list of equal tips ("keep the main thing the main thing").`;

export type SystemBlock = { text: string; cache?: boolean };

/** Joins consecutive chunks, dropping the overlap the chunker added. */
function joinChunks(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    if (!out) { out = part; continue; }
    let overlap = 0;
    for (let n = Math.min(400, out.length, part.length); n > 0; n--) {
      if (out.endsWith(part.slice(0, n))) { overlap = n; break; }
    }
    out += overlap ? part.slice(overlap) : `\n${part}`;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
export async function loadBrain(admin: any): Promise<string> {
  const { data: docs } = await admin
    .from("knowledge_docs").select("id, title, created_at")
    .eq("source_type", "brain").order("created_at");
  if (!docs?.length) return "";
  const { data: rows } = await admin
    .from("knowledge_chunks").select("doc_id, chunk_index, content")
    .in("doc_id", docs.map((d: { id: string }) => d.id))
    .order("chunk_index").limit(10000);
  return docs.map((d: { id: string; title: string }) => {
    const parts = (rows ?? [])
      .filter((r: { doc_id: string }) => r.doc_id === d.id)
      .map((r: { content: string }) => r.content);
    return `## ${d.title}\n\n${joinChunks(parts)}`;
  }).join("\n\n");
}

