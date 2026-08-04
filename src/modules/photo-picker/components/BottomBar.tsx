import { useTranslation } from "@/core/lib/i18n";

export function BottomBar() {
  const { t } = useTranslation();

  return (
    <div className="glass-panel px-6 py-3 flex items-center justify-center">
      <span className="text-sm font-medium text-muted-foreground">
        {t("footer_text")}
      </span>
    </div>
  );
}
