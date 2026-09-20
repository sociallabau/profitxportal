// Submits pending Drive recordings to Deepgram for transcription.
//
// Deepgram fetches the media from our transcript-media proxy using a one-time
// token, transcribes asynchronously, and posts the result back to
// transcribe-callback, which writes it into the knowledge base.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // An admin clicking the button, or the scheduled job.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const isCron = Boolean(cronSecret && providedSecret === cronSecret);

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

    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramKey) return json({ error: "DEEPGRAM_API_KEY is not set" }, 500);

    const callbackSecret = Deno.env.get("TRANSCRIBE_CALLBACK_SECRET");
    if (!callbackSecret) return json({ error: "TRANSCRIBE_CALLBACK_SECRET is not set" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const jobIds: string[] | undefined = body?.jobIds;
    const limit = Math.min(Number(body?.limit ?? 5), 20);

    let query = admin
      .from("transcription_jobs")
      .select("id, drive_file_id, title, status")
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(limit);
    if (jobIds?.length) query = admin
      .from("transcription_jobs")
      .select("id, drive_file_id, title, status")
      .in("id", jobIds);

    const { data: jobs } = await query;
    if (!jobs?.length) return json({ submitted: 0, message: "Nothing waiting" });

    let submitted = 0;
    const errors: string[] = [];

    for (const job of jobs) {
      try {
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        await admin.from("transcription_jobs").update({
          access_token: token,
          status: "submitting",
          provider: "deepgram",
          error: null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        const mediaUrl =
          `${supabaseUrl}/functions/v1/transcript-media?job=${job.id}&t=${token}`;
        const callbackUrl =
          `${supabaseUrl}/functions/v1/transcribe-callback?job=${job.id}&s=${callbackSecret}`;

        const params = new URLSearchParams({
          model: "nova-3",
          smart_format: "true",
          punctuate: "true",
          paragraphs: "true",
          diarize: "true",
          callback: callbackUrl,
        });

        const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: mediaUrl }),
        });

        if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`);
        const result = await res.json();

        await admin.from("transcription_jobs").update({
          status: "transcribing",
          provider_job_id: result.request_id ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        submitted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${job.title}: ${message}`);
        await admin.from("transcription_jobs").update({
          status: "failed",
          error: message.slice(0, 500),
          access_token: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
      }
    }

    return json({ submitted, errors });
  } catch (err) {
    console.error("transcribe error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
