import PageLayout from "@/components/PageLayout";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const checklistData = [
  {
    pillar: "BUILD", color: "text-pillar-build",
    modules: [
      { name: "Define Your Retainer Offer", tasks: ["Identify target client", "Define deliverables", "Write offer summary"], completed: [true, true, false] },
      { name: "Price Your Package", tasks: ["Research competitor pricing", "Set your price point", "Create pricing tier doc"], completed: [true, false, false] },
    ],
  },
  {
    pillar: "TRAFFIC", color: "text-pillar-traffic",
    modules: [
      { name: "Define Your Ideal Client", tasks: ["Create ICP document", "List pain points", "Identify platforms"], completed: [true, true, true] },
      { name: "Your Content Strategy", tasks: ["Choose primary platform", "Set posting cadence", "Create content calendar"], completed: [true, true, false] },
    ],
  },
];

export default function Checklist() {
  const [openPillars, setOpenPillars] = useState<string[]>(["BUILD"]);

  const toggle = (p: string) =>
    setOpenPillars((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Checklist</h1>

      <div className="space-y-4">
        {checklistData.map((pillar) => (
          <div key={pillar.pillar} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(pillar.pillar)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <h3 className={`text-sm font-bold ${pillar.color}`}>{pillar.pillar}</h3>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPillars.includes(pillar.pillar) ? "rotate-180" : ""}`} />
            </button>
            {openPillars.includes(pillar.pillar) && (
              <div className="px-5 pb-5 space-y-4">
                {pillar.modules.map((mod) => {
                  const done = mod.completed.filter(Boolean).length;
                  const total = mod.tasks.length;
                  const allDone = done === total;
                  return (
                    <div key={mod.name} className={`rounded-lg border p-4 ${allDone ? "border-success/30 bg-success/5" : "border-border"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-foreground">
                          {allDone && "✅ "}{mod.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{done}/{total}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full mb-3">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                      </div>
                      <div className="space-y-2">
                        {mod.tasks.map((task, i) => (
                          <label key={i} className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" defaultChecked={mod.completed[i]} className="h-4 w-4 rounded border-border accent-primary" />
                            <span className={`text-sm ${mod.completed[i] ? "text-muted-foreground line-through" : "text-foreground"}`}>{task}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
