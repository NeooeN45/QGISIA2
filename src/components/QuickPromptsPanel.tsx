import { Layers, Globe, BarChart3, FileText, Search, Zap, Flame, Mountain } from "lucide-react";
import { QUICK_PROMPTS, type QuickPrompt } from "../lib/quick-prompts";

interface QuickPromptsPanelProps {
  onSelectPrompt: (prompt: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Layers: <Layers size={16} />,
  Globe: <Globe size={16} />,
  BarChart3: <BarChart3 size={16} />,
  FileText: <FileText size={16} />,
  Search: <Search size={16} />,
  Zap: <Zap size={16} />,
  Flame: <Flame size={16} />,
  Mountain: <Mountain size={16} />,
};

export default function QuickPromptsPanel({ onSelectPrompt }: QuickPromptsPanelProps) {
  const getCategoryColor = (category: QuickPrompt["category"]) => {
    switch (category) {
      case "analysis":
        return "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40";
      case "data":
        return "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40";
      case "export":
        return "from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40";
      default:
        return "from-teal-500/10 to-teal-500/5 border-teal-500/20 hover:border-teal-500/40";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/55">
        Analyses forestières rapides
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt.prompt)}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left transition-all hover:scale-[1.02] ${getCategoryColor(prompt.category)}`}
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 text-gray-400 dark:text-white/60 group-hover:text-gray-700 dark:group-hover:text-white/90 transition-colors">
                {ICON_MAP[prompt.iconName] || <Zap size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{prompt.title}</p>
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-white/45 line-clamp-2">{prompt.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
