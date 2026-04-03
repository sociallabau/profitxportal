import PageLayout from "@/components/PageLayout";
import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";

const CIRCLE_AI_URL = "https://app.circle.so/sign_in";

const tools = [
  { name: "Retainer Offer Builder", category: "Build", description: "Build your video retainer offer structure and pricing" },
  { name: "Case Study Writer", category: "Build", description: "Turn client results into compelling written case studies" },
  { name: "Content Idea Generator", category: "Traffic", description: "Generate 30 days of content ideas for your video niche" },
  { name: "Instagram Caption Writer", category: "Traffic", description: "Write captions that attract your ideal client" },
  { name: "Discovery Call Script", category: "Sales", description: "Generate a discovery call script tailored to your offer" },
  { name: "Objection Handler", category: "Sales", description: "Get responses to common client objections" },
  { name: "SOP Writer", category: "Scale", description: "Turn your process into a documented SOP your team can follow" },
  { name: "Job Ad Generator", category: "Scale", description: "Write a job ad to hire your first video editor" },
];

const categoryColor: Record<string, string> = {
  Build: "bg-pillar-build/10 text-pillar-build",
  Traffic: "bg-pillar-traffic/10 text-pillar-traffic",
  Sales: "bg-pillar-sales/10 text-pillar-sales",
  Scale: "bg-pillar-scale/10 text-pillar-scale",
};

const tabs = ["All", "Build", "Traffic", "Sales", "Scale"];

export default function AIToolkit() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  const filtered = tools.filter(
    (t) =>
      (activeTab === "All" || t.category === activeTab) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">AI Toolkit</h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI-powered growth assistants</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tool) => (
          <div key={tool.name} className="bg-card border border-border rounded-xl p-5 flex flex-col animate-fade-in">
            <span className={`self-start text-xs px-2.5 py-0.5 rounded-full font-medium mb-3 ${categoryColor[tool.category]}`}>
              {tool.category}
            </span>
            <h3 className="text-sm font-bold text-foreground mb-1.5">{tool.name}</h3>
            <p className="text-sm text-muted-foreground flex-1 mb-4">{tool.description}</p>
            <a
              href={CIRCLE_AI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors self-start"
            >
              Open Tool <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
