import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2, Copy, RefreshCw, Check, AlertTriangle, Loader2, Settings as SettingsIcon } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Pillar = "Problem" | "Plan" | "Proof" | "Philosophy";

const PILLARS: { id: Pillar; label: string; desc: string }[] = [
  { id: "Problem", label: "Problem", desc: "Call out the exact pain your client feels" },
  { id: "Plan", label: "Plan", desc: "Give them a simple roadmap to fix it" },
  { id: "Proof", label: "Proof", desc: "Show a real result from a real client" },
  { id: "Philosophy", label: "Philosophy", desc: "Share what you believe about content and business" },
];

const QUESTION_BANK: Record<Pillar, string[]> = {
  Problem: [
    "What's the #1 reason your ideal client loses work, even when they're actually good at their job?",
    "What does your client's online presence look like right now vs. what it should look like?",
    "What happens when a potential customer Googles your client and lands on their socials?",
    "Why do good tradies or agents lose jobs to worse competitors?",
  ],
  Plan: [
    "What are 3 things your client could do this week to look more credible online?",
    "If you had 30 days to transform a client's presence, what would you do first?",
    "Walk through what month one of working together actually looks like.",
    "What's the minimum a service business needs to post to start getting inbound leads?",
  ],
  Proof: [
    "What's the most tangible result you've gotten for a client, in actual numbers?",
    "What changed for a client 60–90 days after starting with you?",
    "Before vs. after, what did their profile, leads, or pipeline look like?",
    "What did a client say to you that showed the content was actually working?",
  ],
  Philosophy: [
    "What do you believe about content that most people in your industry haven't figured out yet?",
    "Why does showing up consistently beat having a perfect post every time?",
    "What would you tell someone who's scared to post about themselves?",
    "Why is being seen more important than being perfect?",
  ],
};

const DISMISS_KEY = "contentGeneratorModalDismissed";

function pickQuestion(pillar: Pillar) {
  const bank = QUESTION_BANK[pillar];
  return bank[Math.floor(Math.random() * bank.length)];
}

interface OutputBlockProps {
  title: string;
  helper?: string;
  content: string;
  loading?: boolean;
  onRegenerate: () => void;
  subjectLine?: string;
}

function OutputBlock({ title, helper, content, loading, onRegenerate, subjectLine }: OutputBlockProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = subjectLine ? `Subject: ${subjectLine}\n\n${content}` : content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy} disabled={loading || !content}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      {subjectLine && (
        <p className="text-xs text-muted-foreground italic mb-2">Subject: {subjectLine}</p>
      )}
      {loading ? (
        <div className="space-y-2 mt-3">
          <div className="h-3 bg-muted/40 rounded animate-pulse" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-4/6" />
        </div>
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed mt-2">
          {content}
        </pre>
      )}
    </Card>
  );
}

export default function ContentGenerator() {
  return (
    <PageLayout>
      <ContentGeneratorView />
    </PageLayout>
  );
}

export function ContentGeneratorView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { data: profile } = useProfile();
  const businessText = profile?.business_overview || "";
  const businessThin = useMemo(
    () => businessText.trim().split(/\s+/).filter(Boolean).length < 50,
    [businessText],
  );

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [reel, setReel] = useState("");
  const [carousel, setCarousel] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [regenLoading, setRegenLoading] = useState<null | "reel" | "carousel" | "email">(null);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) setShowOnboarding(true);
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShowOnboarding(false);
  };

  const selectPillar = (p: Pillar) => {
    setPillar(p);
    setQuestion(pickQuestion(p));
    setAnswer("");
    setReel("");
    setCarousel("");
    setEmailSubject("");
    setEmailBody("");
  };

  const callApi = async (part: "all" | "reel" | "carousel" | "email") => {
    if (!pillar) return null;
    const { data, error } = await supabase.functions.invoke("generate-content", {
      body: { pillar, question, answer, part },
    });
    if (error) {
      toast.error(error.message || "Generation failed");
      return null;
    }
    const result = data as { error?: string } | null;
    if (result?.error) {
      toast.error(result.error);
      return null;
    }
    return data as {
      reel?: string;
      carousel?: string;
      emailSubject?: string;
      emailBody?: string;
    };
  };

  const handleGenerate = async () => {
    if (!pillar || answer.trim().length < 5) {
      toast.error("Pick a P and answer the question first");
      return;
    }
    setLoading(true);
    const data = await callApi("all");
    if (data) {
      setReel(data.reel || "");
      setCarousel(data.carousel || "");
      setEmailSubject(data.emailSubject || "");
      setEmailBody(data.emailBody || "");
    }
    setLoading(false);
  };

  const handleRegen = async (part: "reel" | "carousel" | "email") => {
    if (!pillar) return;
    setRegenLoading(part);
    const data = await callApi(part);
    if (data) {
      if (part === "reel" && data.reel) setReel(data.reel);
      if (part === "carousel" && data.carousel) setCarousel(data.carousel);
      if (part === "email") {
        if (data.emailBody) setEmailBody(data.emailBody);
        if (data.emailSubject) setEmailSubject(data.emailSubject);
      }
    }
    setRegenLoading(null);
  };

  const hasOutputs = reel || carousel || emailBody;

  return (
    <>
      <Dialog open={showOnboarding} onOpenChange={(o) => !o && dismissOnboarding()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Before you start</DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-3 pt-2">
              <p>
                This tool uses your Settings → About Your Business section to personalise everything it generates.
              </p>
              <p>
                Go write that section in your own words, how you'd talk to a client, who you help, what you do.
                Don't write a corporate bio. Write like you talk.
              </p>
              <p>The more real it sounds in there, the more real the output sounds in here.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Link to="/settings">
              <Button variant="outline" onClick={dismissOnboarding}>Go to Settings</Button>
            </Link>
            <Button onClick={dismissOnboarding}>I've done this, let's go</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!hideHeader && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Wand2 className="w-7 h-7 text-primary" />
            Content Generator
          </h1>
          <p className="text-muted-foreground">
            One topic, one P, three pieces of content. A reel framework, a carousel, and a lead email.
          </p>
        </div>
      )}

      {businessThin && (
        <Card className="p-4 mb-6 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-foreground/90">
              Your About Your Business section looks a bit thin. Head to{" "}
              <Link to="/settings" className="text-primary underline inline-flex items-center gap-1">
                Settings <SettingsIcon className="w-3 h-3" />
              </Link>{" "}
              and fill it out in your own words. The more detail you add, the better this tool performs.
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Pick your P */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Step 1 — Pick your P
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PILLARS.map((p) => {
            const active = pillar === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectPillar(p.id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  active
                    ? "bg-primary/10 border-primary shadow-md shadow-primary/20"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <div className={`font-semibold mb-1 ${active ? "text-primary" : "text-foreground"}`}>
                  {p.label}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">{p.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Question */}
      {pillar && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Step 2 — Your answer
            </h2>
            <button
              onClick={() => setQuestion(pickQuestion(pillar))}
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> New question
            </button>
          </div>
          <Card className="p-4 bg-card border-border">
            <p className="text-foreground font-medium mb-3">{question}</p>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer in a sentence or two, don't overthink it."
              className="min-h-[100px] bg-background border-border"
            />
          </Card>
        </section>
      )}

      {/* Step 3: Generate */}
      {pillar && (
        <div className="mb-8">
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={loading || answer.trim().length < 5}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" /> Generate
              </>
            )}
          </Button>
        </div>
      )}

      {/* Outputs */}
      {(loading || hasOutputs) && (
        <div className="space-y-4">
          <OutputBlock
            title="Reel Framework"
            helper="Use this as your filming guide. Don't read it word for word, use it to know what to say and in what order. Your version will always sound better than a script."
            content={reel}
            loading={loading || regenLoading === "reel"}
            onRegenerate={() => handleRegen("reel")}
          />
          <OutputBlock
            title="Carousel Slides"
            helper="Copy-ready slides. Lift them straight in or tweak to match your voice."
            content={carousel}
            loading={loading || regenLoading === "carousel"}
            onRegenerate={() => handleRegen("carousel")}
          />
          <OutputBlock
            title="Lead Email"
            helper="Send this to anyone you've been meaning to follow up with. Also a good reference for what your reel should sound like."
            content={emailBody}
            subjectLine={emailSubject}
            loading={loading || regenLoading === "email"}
            onRegenerate={() => handleRegen("email")}
          />
          {hasOutputs && !loading && (
            <p className="text-xs text-muted-foreground italic px-1 pt-2">
              This is a starting point. Rewrite anything that doesn't sound like you, especially the email.
              Best results come from taking 80% of this and adding your own words, your own story, your own examples.
            </p>
          )}
        </div>
      )}
    </>

  );
}
