import { useAppStore } from "@/stores/useAppStore";
import { useTranslation } from "@/lib/i18n";
import {
  Camera,
  Settings,
  Clock,
  Info,
  Sparkles,
} from "lucide-react";
import type { MainTab } from "@/types";

export function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const { t } = useTranslation();

  const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t("home"), icon: <Camera size={18} /> },
    { id: "history", label: t("history"), icon: <Clock size={18} /> },
    { id: "settings", label: t("settings"), icon: <Settings size={18} /> },
    { id: "about", label: t("about"), icon: <Info size={18} /> },
  ];

  return (
    <div className="flex items-center justify-between px-6 py-4 glass-nav border-b border-white/10">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-gradient">
            Minh Vuong Devtool
          </h1>
        </div>
      </div>

      <nav className="flex items-center gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn-ghost text-sm font-medium py-2 px-4 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
