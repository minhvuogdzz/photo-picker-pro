import { useTranslation } from "@/core/lib/i18n";

export function BottomBar() {
  const { t } = useTranslation();

  return (
    <div className="bg-card/90 backdrop-blur-md px-4 py-2 flex items-center justify-center">
      <span className="text-[11px] font-medium text-muted-foreground">
        {t("footer_text")}
      </span>
    </div>
  );
}
