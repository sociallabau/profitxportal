import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { useCanUseDanAi } from '@/lib/danAccess';

/** The Dan AI brain on the Dashboard: one tap to ask Dan anything. */
export default function DanAiButton({ isAdmin }: { isAdmin: boolean }) {
  const canUse = useCanUseDanAi(isAdmin);
  if (!canUse) return null;
  return (
    <Link to="/dan-ai" aria-label="Ask Dan AI" className="group inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 bg-card border border-primary/30 hover:border-primary/60 transition-colors shadow-lg shadow-primary/10">
      <span className="relative grid place-items-center w-9 h-9 rounded-full violet-grad text-white shadow-[0_0_18px_rgb(155_92_255/0.55)]">
        <Brain className="w-5 h-5" strokeWidth={2.2} />
        <span className="absolute inset-0 rounded-full ring-2 ring-white/30 group-hover:ring-white/60 transition" aria-hidden />
      </span>
      <span className="text-sm font-semibold">Ask Dan AI</span>
    </Link>
  );
}
