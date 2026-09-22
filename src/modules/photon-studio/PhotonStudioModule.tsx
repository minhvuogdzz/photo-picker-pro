import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  Play, 
  Square, 
  RefreshCw, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  FolderOpen,
  Maximize2,
  Minimize2,
  Eye,
  ArrowUpRight,
  SlidersHorizontal,
  Check,
  Crown,
  ArrowLeft
} from "lucide-react";
import photonIconUrl from "@/assets/photon-icon.png";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LicenseManager } from "@/core/license/LicenseManager";

type IntegrationMode = "companion" | "auto_minimize" | "standard";

export function PhotonStudioModule() {
  const session = useAuthStore((s) => s.session);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);
  const [isCompanionActive, setIsCompanionActive] = useState<boolean>(false);
  
  const [mode, setMode] = useState<IntegrationMode>(() => {
    return (localStorage.getItem("mvd_photon_integration_mode") as IntegrationMode) || "companion";
  });

  const parsedCodes = useAppStore((s) => s.parsedCodes);
  const outputFolder = useAppStore((s) => s.outputFolder);
  const studioOutputFolder = useAppStore((s) => s.studioOutputFolder);
  const matchResult = useAppStore((s) => s.matchResult);

  const hasConfirmedRunningRef = useRef<boolean>(false);

  const matchedPhotosList = useMemo(() => {
    if (!matchResult?.matches) return [];
    return matchResult.matches
      .map((m) => m.photo?.full_path)
      .filter((p): p is string => Boolean(p));
  }, [matchResult]);

  const isPremium = session?.subscription?.isPremium === true || session?.subscription?.status === "LIFETIME";

  const checkStatus = useCallback(async () => {
    try {
      const running = await invoke<boolean>("check_photon_studio_status");
      setIsRunning(running);

      // Seamless Auto-Restore: Only restore if Photon was confirmed running and now closed
      if (hasConfirmedRunningRef.current && !running) {
        hasConfirmedRunningRef.current = false;
        if (mode === "auto_minimize") {
          await invoke("restore_main_window").catch(console.error);
        } else if (mode === "companion" && isCompanionActive) {
          await invoke("set_window_companion_mode", { enabled: false }).catch(console.error);
          setIsCompanionActive(false);
        }
      } else if (running) {
        hasConfirmedRunningRef.current = true;
      }
    } catch (err) {
      console.warn("Failed to check Photon status:", err);
    }
  }, [mode, isCompanionActive]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleModeChange = (newMode: IntegrationMode) => {
    setMode(newMode);
    localStorage.setItem("mvd_photon_integration_mode", newMode);
  };

  const handleLaunch = async (photosToOpen?: string[]) => {
    if (!isPremium) {
      setErrorMessage("MVD Generation là đặc quyền dành riêng cho tài khoản VIP Premium.");
      return;
    }

    setIsLaunching(true);
    setErrorMessage(null);
    setStatusMessage(photosToOpen && photosToOpen.length > 0 
      ? `Đang mở ${photosToOpen.length} ảnh trong MVD Generation (Native Metal)...`
      : "Đang chuẩn bị môi trường & khởi chạy MVD Generation (Native Metal)...");

    try {
      // 1. Launch MVD Generation (Native Swift + Metal Engine)
      const msg = await invoke<string>("launch_photon_studio", {
        photos: photosToOpen && photosToOpen.length > 0 ? photosToOpen : null
      });
      setStatusMessage(msg || "Đã khởi chạy cửa sổ MVD Generation thành công");
      setIsRunning(true);

      // 2. Apply Seamless Window Behavior based on selected mode
      if (mode === "companion") {
        setTimeout(async () => {
          try {
            await invoke("set_window_companion_mode", { enabled: true });
            setIsCompanionActive(true);
          } catch (e) {
            console.error("Failed to enter companion mode:", e);
          }
        }, 800);
      } else if (mode === "auto_minimize") {
        setTimeout(async () => {
          try {
            await invoke("minimize_main_window");
          } catch (e) {
            console.error("Failed to auto minimize:", e);
          }
        }, 1500);
      }

      setTimeout(checkStatus, 2000);
    } finally {
      setIsLaunching(false);
    }
  };

  const autoLaunchedRef = useRef(false);

  useEffect(() => {
    if (!autoLaunchedRef.current && isPremium && !isRunning) {
      autoLaunchedRef.current = true;
      handleLaunch(matchedPhotosList.length > 0 ? matchedPhotosList : undefined);
    }
  }, [isPremium, isRunning]);

  const handleTerminate = async () => {
    try {
      await invoke("terminate_photon_studio");
      setIsRunning(false);
      hasConfirmedRunningRef.current = false;
      setStatusMessage("Đã đóng MVD Generation");
      setTimeout(checkStatus, 1000);
    } catch (err) {
      const errStr = typeof err === "string" ? err : String(err);
      setErrorMessage(errStr);
    }
  };

  const toggleCompanionMode = async () => {
    const next = !isCompanionActive;
    try {
      await invoke("set_window_companion_mode", { enabled: next });
      setIsCompanionActive(next);
    } catch (e) {
      console.error("Failed to toggle companion mode:", e);
    }
  };

  const handleCopyCodes = () => {
    const codes = parsedCodes.map((c) => c.raw || c.normalized).join(", ");
    if (codes) {
      navigator.clipboard.writeText(codes);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const openFolder = async (folderPath: string) => {
    if (!folderPath) return;
    try {
      await invoke("plugin:opener|open_path", { path: folderPath, with: null });
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  // VIP Premium Gatekeeper Screen
  if (!isPremium) {
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

        {/* VIP Crown Box */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3 shadow-inner">
          <Crown size={22} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-semibold mb-2.5">
          <Sparkles size={11} />
          <span>ĐẶC QUYỀN VIP RETOUCH ENGINE</span>
        </div>

        <h2 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">
          MVD Generation Dành Riêng Cho Tài Khoản VIP Premium
        </h2>

        <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
          Bộ công cụ thế hệ mới <strong>MVD Generation</strong> với khả năng xử lý đồ họa chuyên sâu và gia tốc Metal GPU chỉ mở khóa dành riêng cho tài khoản được cấp quyền <strong>VIP Premium</strong>.
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
            <Crown size={13} />
            <span>Đổi quyền lợi / Đăng ký Premium</span>
          </button>
        </div>

        {showLicenseModal && (
          <LicenseManager
            onClose={() => setShowLicenseModal(false)}
            initialMode="request"
            initialIsPremium={true}
            variant="modal"
          />
        )}
      </div>
    );
  }

  // COMPANION MINI WIDGET VIEW (When user activates companion mode)
  if (isCompanionActive) {
    return (
      <div className="flex flex-col h-full bg-card text-foreground p-3.5 select-none overflow-hidden text-xs">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={photonIconUrl} alt="Photon" className="w-5 h-5 object-contain" />
            <span className="font-bold text-[12px] tracking-tight text-foreground">Photon Companion</span>
          </div>
          <button
            onClick={toggleCompanionMode}
            className="p-1 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Phóng to Super-App lại kích thước đầy đủ"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/60 border border-border mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            <span className="font-medium text-[11px]">
              {isRunning ? "MPhoton đang mở" : "Photon đã dừng"}
            </span>
          </div>
          {isRunning && (
            <button
              onClick={handleTerminate}
              className="text-[10px] text-destructive hover:underline font-medium cursor-pointer"
            >
              Đóng app
            </button>
          )}
        </div>

        {/* Studio Quick Actions */}
        <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-0.5">
          {/* Customer Codes Quick Copy */}
          <div className="p-2.5 rounded-xl bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-foreground">Mã ảnh khách chọn</span>
              <span className="text-[10px] text-muted-foreground">{parsedCodes.length} mã</span>
            </div>

            {parsedCodes.length > 0 ? (
              <>
                <div className="max-h-24 overflow-y-auto custom-scrollbar p-1.5 rounded-lg bg-muted/40 font-mono text-[10px] text-muted-foreground break-all">
                  {parsedCodes.map((c) => c.raw || c.normalized).join(", ")}
                </div>
                <button
                  onClick={handleCopyCodes}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-[11px] transition-colors cursor-pointer"
                >
                  {copiedCodes ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCodes ? "Đã chép danh sách mã!" : "Sao chép danh sách mã"}</span>
                </button>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground italic py-1">
                Chưa có mã từ Photo Picker. Bạn có thể nhập mã ở trang Lọc ảnh.
              </p>
            )}
          </div>

          {/* Target Folder Quick Access */}
          <div className="p-2.5 rounded-xl bg-background border border-border space-y-2">
            <span className="font-semibold text-[11px] text-foreground">Thư mục làm việc</span>
            
            {studioOutputFolder || outputFolder ? (
              <button
                onClick={() => openFolder(studioOutputFolder || outputFolder)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderOpen size={13} className="text-amber-500 shrink-0" />
                  <span className="truncate text-[10px] font-mono">
                    {(studioOutputFolder || outputFolder).split("/").pop()}
                  </span>
                </div>
                <ArrowUpRight size={12} className="text-muted-foreground shrink-0" />
              </button>
            ) : (
              <p className="text-[10px] text-muted-foreground italic py-1">
                Chưa chọn thư mục xuất ảnh ở Photo Picker.
              </p>
            )}
          </div>
        </div>

        {/* Bottom Switch button */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={toggleCompanionMode}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary/90 transition-colors"
          >
            <Maximize2 size={13} />
            <span>Phóng to Super-App</span>
          </button>
        </div>
      </div>
    );
  }

  // STANDARD FULL WINDOW VIEW
  return (
    <div className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden p-6 md:p-8 custom-scrollbar bg-background text-foreground">
      
      {/* Ambient background glows */}
      <div className="fixed top-[-10%] right-[-5%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none hidden dark:block" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-600/8 rounded-full blur-[130px] pointer-events-none hidden dark:block" />

      <div className="w-full max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* TOP STATUS HERO CARD */}
        <div className="rounded-3xl p-7 md:p-8 bg-card/80 backdrop-blur-xl border border-border shadow-md relative overflow-hidden">
          
          {/* Top shimmer banner */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* App Branding & Icon */}
            <div className="flex items-center gap-5">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl p-2 bg-gradient-to-b from-cyan-500/15 to-blue-500/10 border border-cyan-500/30 shadow-md flex items-center justify-center">
                  <img 
                    src={photonIconUrl} 
                    alt="MVD Generation" 
                    className="w-full h-full object-contain drop-shadow-sm select-none"
                    draggable={false}
                  />
                </div>
                {isRunning && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    MVD Generation
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                    Native Metal Engine
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    33 MB • GPU Accelerated
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Công cụ thế hệ mới MVD Generation gia tốc phần cứng Apple Metal GPU, xử lý layer, mask, curves và liên thông dữ liệu trực tiếp trong Super-App.
                </p>

                {/* Status Indicator Pill */}
                <div className="mt-3 flex items-center gap-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                    isRunning 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-xs" 
                      : "bg-muted/70 border-border text-muted-foreground"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                    {isRunning ? "Cửa sổ MVD Generation đang hoạt động" : "MVD Generation chưa khởi chạy"}
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Controls */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
              <button
                onClick={() => handleLaunch()}
                disabled={isLaunching}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-98 cursor-pointer ${
                  isRunning
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/25"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
                }`}
              >
                {isLaunching ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang khởi chạy...</span>
                  </>
                ) : isRunning ? (
                  <>
                    <ExternalLink size={16} />
                    <span>Mở / Focus vào cửa sổ</span>
                  </>
                ) : (
                  <>
                    <Play size={16} className="fill-current" />
                    <span>Khởi chạy ứng dụng</span>
                  </>
                )}
              </button>

              {isRunning && (
                <button
                  onClick={handleTerminate}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/25 transition-all cursor-pointer"
                >
                  <Square size={13} className="fill-current" />
                  <span>Đóng MVD Generation</span>
                </button>
              )}
            </div>

          </div>

          {/* Feedback messages */}
          {statusMessage && !errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* SEAMLESS WORKFLOW INTEGRATION MODES */}
        <div className="p-5 md:p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-primary" />
                <span>Chế độ trải nghiệm liền mạch (Seamless Experience)</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Tự động tối ưu hóa cửa sổ Super-App khi bạn chuyển sang làm việc với MPhoton.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Mode 1: Companion */}
            <div 
              onClick={() => handleModeChange("companion")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                mode === "companion"
                  ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                  : "bg-muted/30 hover:bg-muted/60 border-border"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    mode === "companion" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Minimize2 size={16} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    Đề xuất
                  </span>
                </div>
                <h3 className="text-xs font-bold text-foreground">Thanh Mini Widget Đồng Hành</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Super-App thu nhỏ thành một thanh công cụ nổi ở góc màn hình, cho phép vừa retouch trong Photon vừa tra cứu mã ảnh khách hàng.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className={mode === "companion" ? "text-primary font-semibold" : "text-muted-foreground"}>
                  {mode === "companion" ? "Đang chọn" : "Bấm để chọn"}
                </span>
                {mode === "companion" && <Check size={14} className="text-primary" />}
              </div>
            </div>

            {/* Mode 2: Auto Minimize */}
            <div 
              onClick={() => handleModeChange("auto_minimize")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                mode === "auto_minimize"
                  ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                  : "bg-muted/30 hover:bg-muted/60 border-border"
              }`}
            >
              <div className="space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  mode === "auto_minimize" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Eye size={16} />
                </div>
                <h3 className="text-xs font-bold text-foreground">Tự động Ẩn & Khôi phục</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tự động thu nhỏ Super-App xuống thanh Dock khi mở MPhoton, và tự phóng to lại ngay khi bạn tắt MPhoton.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className={mode === "auto_minimize" ? "text-primary font-semibold" : "text-muted-foreground"}>
                  {mode === "auto_minimize" ? "Đang chọn" : "Bấm để chọn"}
                </span>
                {mode === "auto_minimize" && <Check size={14} className="text-primary" />}
              </div>
            </div>

            {/* Mode 3: Standard */}
            <div 
              onClick={() => handleModeChange("standard")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                mode === "standard"
                  ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                  : "bg-muted/30 hover:bg-muted/60 border-border"
              }`}
            >
              <div className="space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  mode === "standard" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Maximize2 size={16} />
                </div>
                <h3 className="text-xs font-bold text-foreground">Cửa sổ Tiêu chuẩn</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Giữ nguyên cửa sổ lớn của Super-App, bạn tự do chuyển đổi qua lại giữa các cửa sổ bằng phím tắt Cmd + Tab.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className={mode === "standard" ? "text-primary font-semibold" : "text-muted-foreground"}>
                  {mode === "standard" ? "Đang chọn" : "Bấm để chọn"}
                </span>
                {mode === "standard" && <Check size={14} className="text-primary" />}
              </div>
            </div>
          </div>
        </div>

        {/* LIVE STUDIO DATA BRIDGE (Liên thông dữ liệu studio) */}
        <div className="p-5 md:p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>Liên thông dữ liệu từ Photo Picker sang MPhoton</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Đồng bộ nhanh danh sách ảnh khách hàng đã chọn để thực hiện retouch trong MPhoton.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Codes & Photos Card */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground">Ảnh khách đã chọn</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    {matchedPhotosList.length > 0 ? `${matchedPhotosList.length} ảnh khớp` : `${parsedCodes.length} mã`}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {matchedPhotosList.length > 0 
                    ? `Đã tìm thấy ${matchedPhotosList.length} tệp ảnh sẵn sàng đưa vào MVD Generation để xử lý.`
                    : parsedCodes.length > 0 
                    ? parsedCodes.slice(0, 15).map(c => c.raw || c.normalized).join(", ") + (parsedCodes.length > 15 ? "..." : "")
                    : "Chưa có ảnh khớp từ khách. Hãy chạy quét mã ở module Photo Picker Pro."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {matchedPhotosList.length > 0 && (
                  <button
                    onClick={() => handleLaunch(matchedPhotosList)}
                    disabled={isLaunching}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>Đẩy {matchedPhotosList.length} ảnh sang MVD Generation</span>
                  </button>
                )}
                {parsedCodes.length > 0 && (
                  <button
                    onClick={handleCopyCodes}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs transition-colors border border-border cursor-pointer"
                  >
                    {copiedCodes ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedCodes ? "Đã chép mã" : "Sao chép mã"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Folder Card */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground">Thư mục kết quả xuất ảnh</span>
                  <FolderOpen size={15} className="text-amber-500" />
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {studioOutputFolder || outputFolder || "Chưa chọn thư mục xuất ở Photo Picker."}
                </p>
              </div>

              {(studioOutputFolder || outputFolder) && (
                <button
                  onClick={() => openFolder(studioOutputFolder || outputFolder)}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs transition-colors border border-border cursor-pointer"
                >
                  <FolderOpen size={13} />
                  <span>Mở thư mục trên Finder</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
