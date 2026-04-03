import PageLayout from "@/components/PageLayout";
import { Trophy } from "lucide-react";
import { useState } from "react";

const initialWins = [
  { text: "Signed 2nd retainer client this month!", date: "3 days ago", week: 14 },
  { text: "Hit 5k followers on Instagram", date: "1 week ago", week: 13 },
  { text: "First YouTube video got 2.4k views", date: "2 weeks ago", week: 12 },
  { text: "Booked 3 discovery calls from one LinkedIn post", date: "3 weeks ago", week: 11 },
];

export default function WeeklyWins() {
  const [wins] = useState(initialWins);
  const [newWin, setNewWin] = useState("");

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Weekly Wins</h1>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          What's your win this week?
        </label>
        <textarea
          value={newWin}
          onChange={(e) => setNewWin(e.target.value)}
          placeholder="Share something you're proud of..."
          className="w-full h-24 px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
        <button className="mt-3 inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
          Submit Win 🏆
        </button>
      </div>

      <div className="space-y-3">
        {wins.map((win, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 animate-fade-in">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">{win.text}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-muted-foreground">{win.date}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  Week {win.week}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
