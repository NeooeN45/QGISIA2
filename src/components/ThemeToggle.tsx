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
      className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all"
    >
      {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
