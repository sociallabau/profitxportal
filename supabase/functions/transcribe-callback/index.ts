// Receives a finished transcript from Deepgram and files it in the knowledge
// base. Authenticated by the secret in its own callback URL, since Deepgram
// cannot present a Supabase JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function chunkText(text: string, size = 1400, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const breakAt = clean.lastIndexOf("\n\n", end);
      if (breakAt > start + size * 0.5) end = breakAt;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** Prefers speaker-labelled paragraphs; falls back to the flat transcript. */
function extractTranscript(payload: Record<string, any>): string {
  const alt = payload?.results?.channels?.[0]?.alternatives?.[0];
  if (!alt) return "";

  const paragraphs = alt.paragraphs?.paragraphs;
  if (Array.isArray(paragraphs) && paragraphs.length) {
    const lines: string[] = [];
    let lastSpeaker: number | null = null;
    for (const p of paragraphs) {
      const sentences = (p.sentences ?? []).map((s: { text: string }) => s.text).join(" ");
      if (!sentences) continue;
      if (typeof p.speaker === "number" && p.speaker !== lastSpeaker) {
        lines.push(`\nSpeaker ${p.speaker}: ${sentences}`);
        lastSpeaker = p.speaker;
      } else {
        lines.push(sentences);
      }
    }
    const joined = lines.join("\n").trim();
    if (joined) return joined;
  }
  return alt.transcript ?? "";
}

/** Same rule the Drive sync uses: Dan teaching beats Dan listening. */
function isTeaching(name: string): boolean {
  return /momentum|q\s*&\s*a|q and a|workshop|hot seat|lesson|masterclass/i.test(name);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job");
    const secret = url.searchParams.get("s");
    const expected = Deno.env.get("TRANSCRIBE_CALLBACK_SECRET");

    if (!jobId || !secret || !expected || secret !== expected) {
      return new Response("Not found", { status: 404 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job } = await admin
      .from("transcription_jobs")
      .select("id, title, drive_file_id, status")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return new Response("Not found", { status: 404 });

    const payload = await req.json();
    const text = extractTranscript(payload);

    if (!text || text.length < 200) {
      await admin.from("transcription_jobs").update({
        status: "failed",
        error: "Deepgram returned no usable transcript",
        access_token: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return new Response("ok");
    }

    const { data: doc, error: docError } = await admin
      .from("knowledge_docs")
      .insert({
        title: job.title,
        source_type: isTeaching(job.title) ? "teaching" : "call",
        source_id: job.drive_file_id,
        source_url: `https://drive.google.com/file/d/${job.drive_file_id}/view`,
        word_count: text.split(/\s+/).length,
      })
      .select("id").single();

    if (docError || !doc) {
      await admin.from("transcription_jobs").update({
        status: "failed",
        error: `Could not save: ${docError?.message ?? "unknown"}`.slice(0, 500),
        access_token: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return new Response("ok");
    }

    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100).map((content, j) => ({
        doc_id: doc.id, chunk_index: i + j, content,
      }));
      await admin.from("knowledge_chunks").insert(batch);
    }

    // Token cleared here, so the media URL stops working the moment the job ends.
    await admin.from("transcription_jobs").update({
      status: "done",
      doc_id: doc.id,
      transcript_chars: text.length,
      access_token: null,
      error: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    return new Response("ok");
  } catch (err) {
    console.error("transcribe-callback error", err);
    return new Response("Error", { status: 500 });
  }
});
