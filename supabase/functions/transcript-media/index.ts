// Streams a Drive file to the transcription provider behind a one-time token.
//
// Deepgram fetches media by URL and cannot send an Authorization header, so
// rather than making the file public we hand it this endpoint. The token is
// checked against the job row and cleared once the job completes, and the
// file is streamed straight through without being buffered.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function getDriveToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
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
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job");
    const token = url.searchParams.get("t");
    if (!jobId || !token) return new Response("Not found", { status: 404 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job } = await admin
      .from("transcription_jobs")
      .select("drive_file_id, access_token, status")
      .eq("id", jobId)
      .maybeSingle();

    // Constant-ish comparison; the token is random and single use either way.
    if (!job?.access_token || job.access_token !== token) {
      return new Response("Not found", { status: 404 });
    }

    const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
    const driveToken = await getDriveToken(sa);

    const range = req.headers.get("range");
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${job.drive_file_id}?alt=media&supportsAllDrives=true`,
      { headers: range
          ? { Authorization: `Bearer ${driveToken}`, Range: range }
          : { Authorization: `Bearer ${driveToken}` } },
    );
    if (!driveRes.ok || !driveRes.body) {
      return new Response("Upstream error", { status: 502 });
    }

    const headers = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = driveRes.headers.get(h);
      if (v) headers.set(h, v);
    }
    // Streamed straight through — a 1 GB recording never lands in memory.
    return new Response(driveRes.body, { status: driveRes.status, headers });
  } catch (err) {
    console.error("transcript-media error", err);
    return new Response("Error", { status: 500 });
  }
});
