// Text behind Vault entries that live outside Drive: Fathom share links
// (older recordings) and public Notion workbooks. Both are public pages.

const decode = (s: string) => s.replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\n{3,}/g, "\n\n").trim();

/** The full transcript of a Fathom share link, speaker by speaker. */
export async function fathomTranscript(token: string): Promise<string> {
  const page = await (await fetch(`https://fathom.video/share/${token}`)).text();
  const callId = page.match(/calls\/(\d+)\/copy_transcript/)?.[1];
  if (!callId) throw new Error("no transcript link on the share page");
  const res = await fetch(`https://fathom.video/calls/${callId}/copy_transcript?token=${token}`);
  if (!res.ok) throw new Error(`transcript ${res.status}`);
  const { html } = await res.json() as { html: string };
  return decode(html.replace(/<a [^>]*>@[\d:]+<\/a> - /g, ""));
}

const dash = (id: string) => id.includes("-") ? id : `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
const rich = (t: unknown) => Array.isArray(t) ? t.map(x => (x as string[])[0]).join("") : "";
type Block = { type?: string; properties?: { title?: unknown }; content?: string[] };

async function loadBlocks(host: string, pageId: string): Promise<Record<string, Block>> {
  const blocks: Record<string, Block> = {};
  let cursor: unknown = { stack: [] };
  for (let n = 0; n < 30; n++) {
    const res = await fetch(`https://${host}/api/v3/loadPageChunk`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId, limit: 100, cursor, chunkNumber: n, verticalColumns: false }),
    });
    const r = await res.json() as { cursor?: { stack?: unknown[] }; recordMap?: { block?: Record<string, { value?: { value?: Block } & Block }> } };
    for (const [k, v] of Object.entries(r.recordMap?.block ?? {})) blocks[k] = (v.value?.value ?? v.value) as Block;
    if (!r.cursor?.stack?.length) break;
    cursor = r.cursor;
  }
  return blocks;
}

/** A public Notion page and its sub-pages (two levels), as plain text with headings and bullets. */
export async function notionText(host: string, rawId: string, depth = 0, seen = new Set<string>()): Promise<string> {
  const id = dash(rawId);
  if (seen.has(id) || depth > 2) return "";
  seen.add(id);
  const blocks = await loadBlocks(host, id);
  const out: string[] = [];
  const list = (t?: string) => t === "bulleted_list" || t === "numbered_list";
  const walk = async (bid: string, indent: number) => {
    const b = blocks[bid];
    if (!b) return;
    if (bid !== id && b.type === "page") { const sub = await notionText(host, bid, depth + 1, seen); if (sub) out.push(sub); return; }
    const txt = rich(b.properties?.title);
    const prefix = b.type === "header" ? "# " : b.type === "sub_header" ? "## " : b.type === "sub_sub_header" ? "### " : list(b.type) ? `${"  ".repeat(indent)}- ` : b.type === "to_do" ? "- [ ] " : "";
    if (txt) out.push(prefix + txt);
    for (const c of b.content ?? []) await walk(c, indent + (list(b.type) ? 1 : 0));
  };
  await walk(id, 0);
  return out.join("\n");
}
