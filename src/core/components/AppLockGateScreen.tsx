import { useState } from "react";
import { Lock, ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { LicenseManager } from "@/core/license/LicenseManager";

interface AppLockGateScreenProps {
  readonly appId: string;
  readonly appName: string;
  readonly description?: string;
}

export function AppLockGateScreen({ appId, appName, description }: AppLockGateScreenProps) {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card/90 backdrop-blur-md rounded-xl border border-border p-8 text-center relative overflow-hidden animate-fade-in select-none text-foreground">
      {/* Back Button */}
      <button
        onClick={() => setActiveModule("launcher")}
        className="absolute top-4 left-4 w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
        title="Quay lại Launcher"
      >
        <ArrowLeft size={14} />
      </button>

      {/* Lock Icon Box */}
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3.5 shadow-sm">
        <Lock size={24} />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[10px] font-semibold mb-2.5">
        <Sparkles size={11} className="text-primary" />
        <span>GÓI BẢN QUYỀN ỨNG DỤNG</span>
      </div>

      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 tracking-tight">
        Kích Hoạt Gói Sử Dụng Cho {appName}
      </h2>

      <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
        {description ||
          `Thời gian dùng thử miễn phí đã kết thúc hoặc tài khoản của bạn chưa kích hoạt gói sử dụng cho ứng dụng ${appName}. Vui lòng đăng ký gói sử dụng để tiếp tục làm việc.`}
      </p>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setActiveModule("launcher")}
          className="h-9 px-3.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground border border-border transition-colors cursor-pointer"
        >
          Quay lại Launcher
        </button>

        <button
          onClick={() => setShowLicenseModal(true)}
          className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <KeyRound size={13} />
          <span>Mua gói / Kích hoạt</span>
        </button>
      </div>

      {showLicenseModal && (
        <LicenseManager
          onClose={() => setShowLicenseModal(false)}
          initialMode="packages"
          defaultTargetApp={appId}
          variant="modal"
        />
      )}
    </div>
  );
}
