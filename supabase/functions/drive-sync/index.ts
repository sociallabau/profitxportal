// Drive sync for Dan AI.
//
// Walks the configured Drive folders and pulls in the text Google already
// generates — Meet transcripts and Gemini notes — chunking them straight into
// the knowledge base. Video files that have no transcript are queued in
// transcription_jobs instead.
//
// Auth: an admin's JWT, or the CRON_SECRET header when run on a schedule.
//
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON (service account with Drive read access,
// with the folders shared to its client_email), DRIVE_FOLDER_IDS (comma
// separated), optional CRON_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const GOOGLE_DOC = "application/vnd.google-apps.document";

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

/** Mints a Drive access token from the service account, no user OAuth needed. */
async function getDriveToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Walks a folder and everything beneath it. Google Meet files one subfolder
 * per call, so a flat listing finds nothing.
 */
async function listFolderTree(
  token: string,
  rootId: string,
  maxDepth = 4,
): Promise<DriveFile[]> {
  const found: DriveFile[] = [];
  const seenFolders = new Set<string>();
  let frontier: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];

  while (frontier.length) {
    const next: { id: string; depth: number }[] = [];

    for (const { id, depth } of frontier) {
      if (seenFolders.has(id)) continue;
      seenFolders.add(id);

      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${id}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
          pageSize: "200",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Drive list ${res.status}: ${await res.text()}`);
        const data = await res.json();

        for (const file of (data.files ?? []) as DriveFile[]) {
          if (file.mimeType === FOLDER_MIME) {
            if (depth < maxDepth) next.push({ id: file.id, depth: depth + 1 });
          } else {
            found.push(file);
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }

    frontier = next;
  }

  return found;
}

type DocTab = {
  tabProperties?: { title?: string };
  documentTab?: { body?: { content?: unknown[] } };
  childTabs?: DocTab[];
};

/** Pulls the plain text out of a Docs API body. */
function extractBodyText(content: unknown[] | undefined): string {
  if (!content) return "";
  let out = "";
  for (const element of content as Record<string, any>[]) {
    const paragraph = element.paragraph;
    if (paragraph?.elements) {
      for (const run of paragraph.elements) {
        const text = run?.textRun?.content;
        if (typeof text === "string") out += text;
      }
    }
    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          out += extractBodyText(cell.content);
        }
      }
    }
  }
  return out;
}

function flattenTabs(tabs: DocTab[] | undefined, out: DocTab[] = []): DocTab[] {
  for (const tab of tabs ?? []) {
    out.push(tab);
    if (tab.childTabs?.length) flattenTabs(tab.childTabs, out);
  }
  return out;
}

/**
 * Meet files the verbatim transcript as a TAB inside the "Notes by Gemini"
 * doc, not as its own file. A plain Drive export can miss it, so read the
 * document through the Docs API with tab content included.
 *
 * Prefers the Transcript tab — Dan's actual words. Falls back to the notes
 * tabs, which are written about him in third person and so are weaker for
 * matching his voice.
 */
async function fetchDocText(
  token: string,
  fileId: string,
): Promise<{ text: string; kind: "transcript" | "notes" }> {
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${fileId}?includeTabsContent=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Docs get ${res.status}: ${await res.text()}`);
  const doc = await res.json();

  const tabs = flattenTabs(doc.tabs);
  if (tabs.length) {
    const transcriptTab = tabs.find(t =>
      /transcript/i.test(t.tabProperties?.title ?? "")
    );
    if (transcriptTab) {
      const text = extractBodyText(transcriptTab.documentTab?.body?.content).trim();
      if (text.length > 500) return { text, kind: "transcript" };
    }
    const notes = tabs
      .map(t => extractBodyText(t.documentTab?.body?.content))
      .join("\n\n")
      .trim();
    if (notes) return { text: notes, kind: "notes" };
  }

  // Docs without tabs still have a top-level body.
  const body = extractBodyText(doc.body?.content).trim();
  return { text: body, kind: "notes" };
}

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

/** Meet transcripts and Gemini notes are the text worth ingesting. */
function isTranscriptLike(name: string): boolean {
  return /transcript|notes by gemini|notes/i.test(name);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const isCron = Boolean(cronSecret && providedSecret === cronSecret);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const scoped = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await scoped.auth.getUser();
      if (!userData?.user) return json({ error: "Unauthorized" }, 401);
      const { data: profile } = await scoped
        .from("profiles").select("is_admin").eq("id", userData.user.id).single();
      if (!profile?.is_admin) return json({ error: "Admins only" }, 403);
    }

    const saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saRaw) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set" }, 500);
    const sa = JSON.parse(saRaw);

    const folderIds = (Deno.env.get("DRIVE_FOLDER_IDS") ?? "")
      .split(",").map(f => f.trim()).filter(Boolean);
    if (!folderIds.length) return json({ error: "DRIVE_FOLDER_IDS is not set" }, 500);

    const token = await getDriveToken(sa);

    const maxDocs = Number(Deno.env.get("DRIVE_SYNC_MAX_DOCS") ?? 5);
    let ingested = 0;
    let remaining = 0;
    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const folderId of folderIds) {
      let files: DriveFile[];
      try {
        files = await listFolderTree(token, folderId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${folderId}: ${message}`);
        await admin.from("drive_sync_state").upsert({
          folder_id: folderId,
          last_synced_at: new Date().toISOString(),
          last_result: `error: ${message}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      for (const file of files) {
        // Already ingested?
        const { data: existing } = await admin
          .from("knowledge_docs").select("id").eq("source_id", file.id).maybeSingle();
        if (existing) { skipped++; continue; }

        if (file.mimeType === GOOGLE_DOC && isTranscriptLike(file.name)) {
          // Each transcript is large, so only take a few per run; the next
          // run (or the next click) picks up where this one stopped.
          if (ingested >= maxDocs) { remaining++; continue; }
          try {
            const { text, kind } = await fetchDocText(token, file.id);
            const chunks = chunkText(text);
            if (!chunks.length) { skipped++; continue; }

            const { data: doc, error: docError } = await admin
              .from("knowledge_docs")
              .insert({
                title: file.name,
                source_type: kind === "transcript" ? "call" : "note",
                source_id: file.id,
                source_url: `https://docs.google.com/document/d/${file.id}`,
                word_count: text.split(/\s+/).length,
              })
              .select("id").single();
            if (docError || !doc) throw docError ?? new Error("insert failed");

            for (let i = 0; i < chunks.length; i += 100) {
              const batch = chunks.slice(i, i + 100).map((content, j) => ({
                doc_id: doc.id, chunk_index: i + j, content,
              }));
              const { error } = await admin.from("knowledge_chunks").insert(batch);
              if (error) throw error;
            }
            ingested++;
          } catch (err) {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
          continue;
        }

        if (file.mimeType.startsWith("video/") || file.mimeType.startsWith("audio/")) {
          const { error } = await admin.from("transcription_jobs").upsert({
            drive_file_id: file.id,
            title: file.name,
            mime_type: file.mimeType,
            size_bytes: file.size ? Number(file.size) : null,
            status: "pending",
            updated_at: new Date().toISOString(),
          }, { onConflict: "drive_file_id", ignoreDuplicates: true });
          if (!error) queued++;
          continue;
        }

        skipped++;
      }

      await admin.from("drive_sync_state").upsert({
        folder_id: folderId,
        last_synced_at: new Date().toISOString(),
        last_result: `${ingested} ingested, ${queued} queued`,
        updated_at: new Date().toISOString(),
      });
    }

    return json({ ingested, queued, skipped, remaining, hasMore: remaining > 0, errors });
  } catch (err) {
    console.error("drive-sync error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
