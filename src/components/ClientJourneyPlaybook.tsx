import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { fillTemplate, type StagePlaybook } from '@/data/clientJourneyPlaybook';

export type PlaybookStage = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  accent: string;
};

type Props = {
  stage: PlaybookStage;
  playbook: StagePlaybook;
  /** The client this playbook was opened from, if any — fills {{name}}. */
  clientName?: string;
  clientPhone?: string;
  kickoffTime: string;
  onKickoffTimeChange: (value: string) => void;
  onClose: () => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  inputCls: string;
};

export default function ClientJourneyPlaybook({
  stage,
  playbook: pb,
  clientName,
  clientPhone,
  kickoffTime,
  onKickoffTimeChange,
  onClose,
  copiedKey,
  onCopy,
  inputCls,
}: Props) {
  const values = { name: clientName, time: kickoffTime };
  const needsTime = (pb.messages || []).some(m => m.body.includes('{{time}}'));

  return (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-8"
          onClick={onClose}
        >
          <div
            className="w-full max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: stage.accent, boxShadow: `0 0 8px ${stage.accent}` }}
                  />
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {stage.emoji} {stage.label}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {clientName ? `For ${clientName}` : stage.description}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/60 shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {pb.note && (
                <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
                  {pb.note}
                </p>
              )}

              {!clientName && (pb.checklist || pb.messages) && (
                <p className="text-[11px] text-muted-foreground">
                  Open this from a client's card to fill their name in automatically.
                </p>
              )}

              {needsTime && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Kickoff call time
                  </label>
                  <input
                    className={inputCls}
                    placeholder="e.g. Tuesday 10am"
                    value={kickoffTime}
                    onChange={e => onKickoffTimeChange(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Drops straight into the message below.
                  </p>
                </div>
              )}

              {/* Steps */}
              {pb.checklist && pb.checklist.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Steps</h3>
                  <ul className="space-y-1.5">
                    {pb.checklist.map((item, i) => {
                      const text = fillTemplate(item, values);
                      const key = `check-${i}`;
                      return (
                        <li key={key} className="flex items-start gap-2 group/item">
                          <span className="text-muted-foreground text-xs mt-0.5 shrink-0">{i + 1}.</span>
                          <span className="text-sm text-foreground flex-1">{text}</span>
                          <button
                            onClick={() => onCopy(text, key)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/60 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                            aria-label="Copy step"
                          >
                            {copiedKey === key ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Messages */}
              {pb.messages && pb.messages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Messages</h3>
                  {pb.messages.map((message, i) => {
                    const body = fillTemplate(message.body, values);
                    const key = `msg-${i}`;
                    return (
                      <div key={key} className="border border-border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                          <span className="text-xs font-semibold text-foreground truncate">{message.label}</span>
                          <button
                            onClick={() => onCopy(body, key)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all shrink-0"
                          >
                            {copiedKey === key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedKey === key ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="px-3 py-3 text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                          {body}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Links */}
              {pb.links && pb.links.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</h3>
                  <div className="space-y-2">
                    {pb.links.map((link, i) => {
                      const key = `link-${i}`;
                      return (
                        <div key={key} className="flex items-center gap-2 border border-border rounded-xl px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                            {link.note && (
                              <p className="text-[11px] text-muted-foreground/80 mt-0.5 italic">{link.note}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onCopy(link.url, key)}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 shrink-0"
                            aria-label="Copy link"
                          >
                            {copiedKey === key ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 shrink-0"
                            aria-label="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!pb.checklist && !pb.messages && !pb.links && !pb.note && (
                <p className="text-sm text-muted-foreground">Nothing to send at this stage.</p>
              )}
            </div>

            {/* Footer */}
            {clientName && (
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border">
                <span className="text-xs text-muted-foreground truncate">{clientPhone}</span>
                <button
                  onClick={() => onCopy(clientPhone || '', 'client-phone')}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all shrink-0"
                >
                  {copiedKey === 'client-phone' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copy number
                </button>
              </div>
            )}
          </div>
        </div>
  );
}
