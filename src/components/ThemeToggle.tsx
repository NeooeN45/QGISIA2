import { Moon, Sun } from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { appendDebugEvent } from "../lib/debug-log";
import { toast } from "sonner";

export default function ThemeToggle() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const toggleTheme = () => {
    const currentTheme = settings.theme;
    const newTheme: "dark" | "light" = currentTheme === "dark" ? "light" : "dark";

    console.log("[THEME TOGGLE] ===========================================");
    console.log("[THEME TOGGLE] Current theme:", currentTheme);
    console.log("[THEME TOGGLE] New theme:", newTheme);
    console.log("[THEME TOGGLE] Toggling theme...");

    appendDebugEvent({
      level: "info",
      source: "theme-toggle",
      title: "Theme Toggle",
      message: `Theme toggle: ${currentTheme} → ${newTheme}`,
    });

    setSettings({ ...settings, theme: newTheme });

    console.log("[THEME TOGGLE] Settings updated");
    toast.success(`Mode ${newTheme === "dark" ? "sombre" : "clair"} activé`);
  };

  return (
    <button
      onClick={toggleTheme}
      title={settings.theme === "dark" ? "Mode clair" : "Mode sombre"}
      className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
    >
      {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
