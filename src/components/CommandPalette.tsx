import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Layers, Settings as SettingsIcon, Code2, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export default function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredCommands = commands.filter((command) => {
    const search = query.toLowerCase();
    return (
      command.label.toLowerCase().includes(search) ||
      command.description.toLowerCase().includes(search) ||
      command.category.toLowerCase().includes(search)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredCommands.length > 0) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#17181a] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <Search size={20} className="text-white/30" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une commande..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/40">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={48} className="text-white/20 mb-4" />
              <p className="text-sm text-white/50">Aucune commande trouvée</p>
              <p className="mt-1 text-xs text-white/30">Essayez une autre recherche</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category}>
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {categoryCommands.map((command, index) => {
                      const globalIndex = filteredCommands.indexOf(command);
                      const isSelected = globalIndex === selectedIndex;
                      return (
                        <button
                          key={command.id}
                          onClick={() => {
                            command.action();
                            onClose();
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all",
                            isSelected
                              ? "bg-blue-500/15 text-white border border-blue-500/25"
                              : "text-white/70 hover:bg-white/5 border border-transparent",
                          )}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                            {command.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{command.label}</p>
                            <p className="mt-0.5 text-xs text-white/50">{command.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 px-6 py-3">
          <div className="flex items-center gap-4 text-[10px] text-white/40">
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↑↓</kbd>
              <span>Naviguer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">Enter</kbd>
              <span>Sélectionner</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">Esc</kbd>
              <span>Fermer</span>
            </div>
          </div>
          <p className="text-[10px] text-white/30">
            {filteredCommands.length} commande(s)
          </p>
        </div>
      </div>
    </div>
  );
}
