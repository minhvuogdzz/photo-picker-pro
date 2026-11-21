import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Key,
  QrCode,
  Loader2,
  X,
  CheckCircle2,
  Copy,
  ShieldCheck,
  Clock,
  ArrowRight,
  Layers,
  FileImage,
  RefreshCw,
  Mail,
  User,
  Phone,
  Info,
  KeyRound,
  Infinity as InfinityIcon,
  Check,
} from "lucide-react";
import { triggerPaymentSuccessConfetti } from "@/core/lib/confettiCelebration";
import { apiRequest } from "@/core/services/apiClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { validateSubscription } from "@/core/services/authApi";
import { socketService } from "@/core/services/socketService";
import { getUserPlanInfo } from "@/core/services/appEntitlementPolicy";
import { useTranslation } from "@/core/lib/i18n";
import {
  getPricingPackages,
  createPaymentOrder,
  checkOrderStatus,
  PricingPackage,
  CreateOrderResponse,
} from "@/core/services/paymentApi";

interface LicenseManagerProps {
  onClose: () => void;
  initialMode?: "my_plan" | "packages" | "activate";
  variant?: "dropdown" | "modal";
  defaultTargetApp?: string;
}

type ViewMode = "my_plan" | "packages" | "qr_checkout" | "paid_success" | "activate" | "activate_success";

export function LicenseManager({
  onClose,
  initialMode = "packages",
  variant = "modal",
  defaultTargetApp = "ALL",
}: LicenseManagerProps) {
  const { tr } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const planInfo = getUserPlanInfo(session);

  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>(defaultTargetApp);
  const [selectedPackage, setSelectedPackage] = useState<PricingPackage | null>(null);

  // Buyer Form State (Bắt buộc theo yêu cầu)
  const [buyerName, setBuyerName] = useState(session?.name || "");
  const [buyerEmail, setBuyerEmail] = useState(session?.email || "");
  const [buyerPhone, setBuyerPhone] = useState("");

  // Payment & QR State
  const [orderData, setOrderData] = useState<CreateOrderResponse | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCheckingOrder, setIsCheckingOrder] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(900); // 15 mins
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Manual Activate State
  const [manualKey, setManualKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [activateSuccessMsg, setActivateSuccessMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load packages from API
  useEffect(() => {
    getPricingPackages().then((pkgs) => {
      const safePkgs = Array.isArray(pkgs) ? pkgs : [];
      setPackages(safePkgs);
      const initial = safePkgs.find((p) => p && p.targetApp === selectedApp && p.isPopular) ||
        safePkgs.find((p) => p && p.targetApp === selectedApp) ||
        safePkgs[0] || null;
      if (initial) setSelectedPackage(initial);
    });
  }, [selectedApp]);

  // Trigger celebratory confetti cannon when reaching paid_success or activate_success
  useEffect(() => {
    if (mode === "paid_success" || mode === "activate_success") {
      triggerPaymentSuccessConfetti();
    }
  }, [mode]);

  // Socket listener for payment success
  useEffect(() => {
    const handlePaymentSuccess = async (data: { orderCode: string; key: string; packageName: string }) => {
      if (orderData && data.orderCode === orderData.orderCode) {
        setGeneratedKey(data.key);
        setMode("paid_success");
        triggerPaymentSuccessConfetti();
        if (pollingRef.current) clearInterval(pollingRef.current);

        // Refresh session
        if (session) {
          try {
            const updated = await validateSubscription(session);
            setSession(updated);
          } catch {}
        }
      }
    };

    socketService.on("paymentSuccess", handlePaymentSuccess);
    return () => {
      socketService.off("paymentSuccess", handlePaymentSuccess);
    };
  }, [orderData, session, setSession]);

  // Polling fallback when QR is showing
  useEffect(() => {
    if (mode === "qr_checkout" && orderData) {
      pollingRef.current = setInterval(async () => {
        try {
          const status = await checkOrderStatus(orderData.orderCode, session?.accessToken);
          if (status.status === "PAID" && status.generatedKey) {
            setGeneratedKey(status.generatedKey);
            setMode("paid_success");
            triggerPaymentSuccessConfetti();
            if (pollingRef.current) clearInterval(pollingRef.current);

            if (session) {
              const updated = await validateSubscription(session);
              setSession(updated);
            }
          }
        } catch {}
      }, 3500);

      // Countdown timer
      const timer = setInterval(() => {
        setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        clearInterval(timer);
      };
    }
  }, [mode, orderData, session, setSession]);

  // Handle Copy to clipboard
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Submit Order Creation
  const handleProceedToQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPackage) return;

    if (!buyerName.trim() || !buyerEmail.trim() || !buyerPhone.trim()) {
      setError(tr(
        "Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại trước khi thanh toán.",
        "Please enter your Full Name, Email, and Phone Number before checkout."
      ));
      return;
    }

    setIsCreatingOrder(true);
    try {
      const order = await createPaymentOrder(
        {
          packageId: selectedPackage.id,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          buyerPhone: buyerPhone.trim(),
        },
        session?.accessToken,
      );

      setOrderData(order);
      setCountdownSeconds(900);
      setMode("qr_checkout");
    } catch (err: any) {
      setError(err?.message || tr("Không thể tạo đơn hàng. Vui lòng thử lại!", "Unable to create order. Please try again!"));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Activate key immediately into current account
  const handleApplyKeyNow = async (keyToApply: string) => {
    setIsActivating(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>("/license/activate", {
        method: "POST",
        body: { key: keyToApply.trim().toUpperCase() },
        accessToken: session?.accessToken,
      });

      if (session) {
        const updated = await validateSubscription(session);
        setSession(updated);
      }
      setActivateSuccessMsg(res.message || tr("Kích hoạt mã bản quyền thành công!", "License key activated successfully!"));
      setMode("activate_success");
    } catch (err: any) {
      setError(err?.message || tr("Không thể kích hoạt mã key này.", "Unable to activate this license key."));
    } finally {
      setIsActivating(false);
    }
  };

  // Manual activate form submit
  const handleManualActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    await handleApplyKeyNow(manualKey);
  };

  const filteredPackages = packages.filter((p) => p.targetApp === selectedApp);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return tr("Không có", "None");
    try {
      const d = new Date(dateStr);
      return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const content = (
    <div className="flex flex-col h-full max-h-[85vh] w-full max-w-2xl bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {tr("Trung Tâm Bản Quyền & Gia Hạn", "License & Renewal Center")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tr("Mở khóa không giới hạn sức mạnh Studio Workflow & Super App", "Unlock unlimited Studio Workflow & Super App capabilities")}
            </p>
          </div>
        </div>
        <button aria-label={tr("Đóng", "Close")}
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6 bg-muted/15 overflow-x-auto shrink-0">
        <button
          onClick={() => {
            setError(null);
            setMode("my_plan");
          }}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            mode === "my_plan"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          {tr("Gói Đang Dùng", "Current Plan")}
        </button>
        <button
          onClick={() => {
            setError(null);
            setMode("packages");
          }}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            mode === "packages" || mode === "qr_checkout" || mode === "paid_success"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="w-4 h-4" />
          {tr("Mua Gói & Gia Hạn Tự Động", "Plans & Auto Renewal")}
        </button>
        <button
          onClick={() => {
            setError(null);
            setMode("activate");
          }}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            mode === "activate" || mode === "activate_success"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="w-4 h-4" />
          {tr("Kích Hoạt Mã Key", "Activate Key")}
        </button>
      </div>

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 0. MY PLAN / CURRENT ENTITLEMENTS VIEW */}
        {mode === "my_plan" && (
          <div className="space-y-5">
            {/* Plan Summary Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-xs">
              <div
                className={`absolute top-0 right-0 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none ${
                  planInfo.isFullApp ? "bg-blue-500" : planInfo.isPhotoPickerOnly ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                      planInfo.isFullApp
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400"
                        : planInfo.isPhotoPickerOnly
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {planInfo.isLifetime ? (
                      <InfinityIcon size={22} />
                    ) : planInfo.isFullApp ? (
                      <Layers size={22} />
                    ) : planInfo.isPhotoPickerOnly ? (
                      <FileImage size={22} />
                    ) : (
                      <Clock size={22} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">
                        {planInfo.planName}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          planInfo.isFullApp && !planInfo.isTrial
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            : planInfo.isPhotoPickerOnly
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : planInfo.isTrial
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : "bg-destructive/15 text-destructive border-destructive/30"
                        }`}
                      >
                        {planInfo.shortBadgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                      {planInfo.description}
                    </p>
                  </div>
                </div>

                {/* Days Count & Expiry Info */}
                <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-border/60">
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">{tr("Thời gian hiệu lực", "Validity")}</span>
                    <span className="text-lg font-extrabold text-foreground">
                      {planInfo.isLifetime ? tr("Vĩnh viễn", "Lifetime") : tr(`${planInfo.daysRemaining ?? 0} ngày`, `${planInfo.daysRemaining ?? 0} days`)}
                    </span>
                  </div>
                  {planInfo.expiresAt && !planInfo.isLifetime && (
                    <span className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {tr("Hạn dùng:", "Expires:")} {formatDate(planInfo.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notice & Context Banner */}
            {planInfo.isPhotoPickerOnly && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-xs">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-800 dark:text-amber-300">{tr("Chính sách sử dụng gói lẻ:", "Single-App Plan Policy:")}</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">
                    {tr(
                      "Bạn đang đăng ký gói riêng cho App Lọc Ảnh. Các ứng dụng khác trong hệ sinh thái (Kho tài nguyên, Cấu hình Sheet, Đếm ảnh...) đang được mở theo thời gian dùng thử (3 ngày). Khi hết số ngày dùng thử, các app khác sẽ tự động khoá. Bạn có thể gia hạn hoặc nâng cấp lên gói Full App bất kỳ lúc nào để mở toàn bộ.",
                      "You are subscribed to the standalone Photo Picker Pro plan. Other ecosystem tools (Creative Resources, Contact the Sheet, Photo Analytics...) are unlocked during the 3-day trial and will lock afterward. You can upgrade to the Full Super App plan anytime to unlock everything."
                    )}
                  </p>
                </div>
              </div>
            )}

            {planInfo.isTrial && (
              <div className="p-3.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 flex items-start gap-3 text-xs">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-800 dark:text-blue-300">{tr("Trải nghiệm Dùng Thử Đầy Đủ:", "Full Trial Experience:")}</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">
                    {tr(
                      "Tài khoản của bạn đang trong thời gian dùng thử 100% tất cả ứng dụng trong Super App. Bạn có thể kích hoạt gói bản quyền bất kỳ lúc nào để làm việc không gián đoạn!",
                      "Your account currently has full trial access to all Super App modules. Activate a license anytime to continue without interruption!"
                    )}
                  </p>
                </div>
              </div>
            )}

            {planInfo.isFullApp && !planInfo.isTrial && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">{tr("Gói Toàn Bộ Super App Siêu Cấp:", "Full Super App Access:")}</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">
                    {tr(
                      "Tài khoản của bạn được mở khoá đầy đủ tất cả các module và tính năng hiện tại cũng như các bản cập nhật mới trong tương lai.",
                      "Your account has full access to all current modules and features as well as upcoming releases."
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Apps Entitlements Detail Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">
                  {tr("Chi tiết quyền truy cập từng ứng dụng:", "Per-App Access Details:")}
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {tr("Tài khoản:", "Account:")} {session?.email}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {planInfo.appsStatus.map((app) => {
                  const isPaid = app.badgeVariant === "paid";
                  const isTrial = app.badgeVariant === "trial";

                  return (
                    <div
                      key={app.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isPaid
                          ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25 dark:border-emerald-500/30 shadow-2xs"
                          : isTrial
                            ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/25 dark:border-amber-500/30 shadow-2xs"
                            : "bg-muted/30 border-border/60 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-foreground">
                          {app.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            isPaid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : isTrial
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {app.badgeText}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                        <span>{app.statusText}</span>
                        {app.expiresAt && (
                          <span className="font-mono text-[10px]">
                            {tr("Hết hạn:", "Expires:")} {formatDate(app.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSelectedApp("ALL");
                    setMode("packages");
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {planInfo.isFullApp
                    ? tr("Gia hạn thêm gói Full App", "Extend Full App Plan")
                    : tr("Nâng cấp lên Toàn Bộ App (Full Combo)", "Upgrade to Full Super App")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {planInfo.isPhotoPickerOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSelectedApp("photo-picker");
                      setMode("packages");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-medium text-xs transition-all cursor-pointer"
                  >
                    {tr("Gia hạn gói Lọc ảnh", "Renew Photo Picker Plan")}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("activate");
                }}
                className="px-3.5 py-2 rounded-xl bg-muted/60 border border-border/80 hover:bg-muted text-foreground font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                {tr("Nhập mã Key kích hoạt", "Enter Activation Key")}
              </button>
            </div>
          </div>
        )}

        {/* 1. PACKAGES VIEW */}
        {mode === "packages" && (
          <form onSubmit={handleProceedToQR} className="space-y-6">
            {/* App Scope Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">{tr("Phạm vi gia hạn:", "Plan Scope:")}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedApp("ALL")}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    selectedApp === "ALL"
                      ? "border-blue-500 bg-blue-500/10 shadow-sm"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <Layers className={`w-5 h-5 mt-0.5 ${selectedApp === "ALL" ? "text-blue-500" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-xs font-bold text-foreground">{tr("Toàn Hệ Sinh Thái (Super App)", "Full Ecosystem (Super App)")}</div>
                    <div className="text-[11px] text-muted-foreground">{tr("Mở khóa mọi app con hiện tại & tương lai", "Unlock all current & upcoming modules")}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedApp("photo-picker")}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    selectedApp === "photo-picker"
                      ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <FileImage className={`w-5 h-5 mt-0.5 ${selectedApp === "photo-picker" ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-xs font-bold text-foreground">{tr("App Photo Picker Pro (Lọc ảnh)", "Photo Picker Pro Only")}</div>
                    <div className="text-[11px] text-muted-foreground">{tr("Sử dụng đầy đủ mọi tính năng lọc ảnh", "Full access to Photo Picker Pro features")}</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Packages Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">{tr("Chọn chu kỳ gia hạn:", "Select billing cycle:")}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {filteredPackages.map((pkg) => {
                  const isSelected = selectedPackage?.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackage(pkg)}
                      className={`relative p-3.5 rounded-xl border text-center transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                          : "border-border hover:border-border/80 hover:bg-muted/40"
                      }`}
                    >
                      {pkg.badge && (
                        <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-white rounded-full shadow">
                          {pkg.badge}
                        </span>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-foreground">{pkg.name.replace(/Gói (Super App|Photo Picker Pro) /i, "")}</div>
                        <div className="text-sm font-extrabold text-primary mt-1">{formatVND(pkg.price)}</div>
                        {pkg.originalPrice && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatVND(pkg.originalPrice)}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground font-medium">
                        {tr(`+${pkg.durationDays} ngày`, `+${pkg.durationDays} days`)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buyer Form Inputs (Bắt buộc theo yêu cầu) */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                {tr("Thông tin người mua (Bảo lưu quyền lợi & Nhận mã Key dự phòng):", "Buyer Information (Receipt & Backup Key Delivery):")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{tr("Họ và tên *", "Full Name *")}</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder={tr("Nguyễn Văn A", "John Doe")}
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{tr("Email nhận Key *", "Delivery Email *")}</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      placeholder="email@gmail.com"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{tr("Số điện thoại *", "Phone Number *")}</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      placeholder="0912345678"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">{tr("Tổng thanh toán:", "Total due:")} </span>
                <span className="text-base font-extrabold text-foreground ml-1">
                  {selectedPackage ? formatVND(selectedPackage.price) : tr("0 đ", "0 VND")}
                </span>
              </div>
              <button
                type="submit"
                disabled={isCreatingOrder || !selectedPackage}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCreatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tr("Đang tạo đơn...", "Creating order...")}
                  </>
                ) : (
                  <>
                    {tr("Tạo mã VietQR thanh toán", "Generate VietQR Code")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2. QR CHECKOUT VIEW */}
        {mode === "qr_checkout" && orderData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left: QR Image */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-border/80 shadow-inner">
                <img
                  src={orderData.qrUrl}
                  alt="VietQR Payment"
                  className="w-56 h-56 object-contain rounded-lg"
                />
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  {tr("Hết hạn sau:", "Expires in:")} <span className="font-mono text-red-600">{formatCountdown(countdownSeconds)}</span>
                </div>
              </div>

              {/* Right: Bank Details & Copy */}
              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                  <div className="text-[11px] text-muted-foreground">{tr("Chủ tài khoản:", "Account Holder:")}</div>
                  <div className="font-bold text-foreground uppercase mt-0.5">
                    {orderData.bankInfo.bankAccountName}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{tr("Số tài khoản:", "Account Number:")}</div>
                    <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                      {orderData.bankInfo.bankAccountNo}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(orderData.bankInfo.bankAccountNo, "acc")}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                  >
                    {copiedField === "acc" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === "acc" ? tr("Đã chép", "Copied") : tr("Sao chép", "Copy")}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{tr("Số tiền:", "Amount:")}</div>
                    <div className="font-bold text-primary text-sm mt-0.5">
                      {formatVND(orderData.amount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(String(orderData.amount), "amt")}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                  >
                    {copiedField === "amt" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === "amt" ? tr("Đã chép", "Copied") : tr("Sao chép", "Copy")}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">{tr("Nội dung chuyển khoản (bắt buộc):", "Transfer Note (Required):")}</div>
                    <div className="font-mono font-extrabold text-amber-900 dark:text-amber-100 text-sm mt-0.5">
                      {orderData.orderCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(orderData.orderCode, "code")}
                    className="p-1.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 flex items-center gap-1 text-[11px] font-bold"
                  >
                    {copiedField === "code" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === "code" ? tr("Đã chép", "Copied") : tr("Sao chép", "Copy")}
                  </button>
                </div>
              </div>
            </div>

            {/* Waiting notification */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                <span>{tr("Đang chờ chuyển khoản... Hệ thống sẽ tự động xuất mã key ngay khi nhận được tiền.", "Waiting for transfer... Your license key will unlock automatically once payment is received.")}</span>
              </div>
              <button
                type="button"
                onClick={() => setMode("packages")}
                className="text-xs text-muted-foreground hover:underline cursor-pointer shrink-0"
              >
                {tr("Hủy / Đổi gói", "Cancel / Change Plan")}
              </button>
            </div>
          </div>
        )}

        {/* 3. PAID SUCCESS VIEW */}
        {mode === "paid_success" && generatedKey && (
          <div className="space-y-6 text-center py-4 relative select-none">
            {/* Ambient celebration emerald & gold glow */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-tr from-emerald-500/20 via-primary/15 to-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div
                className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-primary/15 to-teal-500/20 border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/15"
              >
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                <span>{tr("GIAO DỊCH THÀNH CÔNG RỰC RỠ", "PAYMENT COMPLETED")}</span>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
                <span>{tr("Thanh Toán Thành Công!", "Payment Successful!")}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                {tr(
                  "Cảm ơn bạn đã tin dùng DH Studio Pro. Hệ thống đã xác thực giao dịch qua SePay và tự động kích hoạt quyền lợi gói dịch vụ vào tài khoản của bạn.",
                  "Thank you for choosing DH Studio Pro. Your payment has been verified and your subscription benefits are now active on your account."
                )}
              </p>
            </div>

            {/* Key Card with luxury glowing border */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-teal-500/10 dark:from-emerald-500/15 dark:via-primary/10 dark:to-teal-500/15 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-xl shadow-emerald-500/5 space-y-3.5 relative overflow-hidden">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1.5">
                <KeyRound size={12} />
                <span>{tr("MÃ BẢN QUYỀN (LICENSE KEY)", "LICENSE KEY")}</span>
              </div>

              <div className="font-mono text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-widest select-all bg-background dark:bg-card/70 py-2.5 px-4 rounded-xl border border-emerald-500/25 shadow-inner">
                {generatedKey}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 size={13} />
                <span>{tr("Đã tự động liên kết trực tiếp vào tài khoản này!", "Automatically linked to your account!")}</span>
              </div>

              <div className="text-[11px] text-muted-foreground">
                {tr("Hóa đơn và mã dự phòng đã gửi tới:", "Receipt & backup key sent to:")} <span className="font-bold text-foreground">{orderData?.buyerEmail || session?.email}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleCopy(generatedKey, "genKey")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border hover:bg-muted font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedField === "genKey" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedField === "genKey" ? tr("Đã sao chép mã Key!", "License Key Copied!") : tr("Sao chép mã Key dự phòng", "Copy Backup Key")}
              </button>

              <button
                type="button"
                onClick={() => setMode("my_plan")}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white font-bold text-xs shadow-lg hover:brightness-110 flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{tr("Xem Gói Đang Dùng", "View Current Plan")}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. MANUAL KEY ACTIVATE VIEW */}
        {mode === "activate" && (
          <form onSubmit={handleManualActivate} className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tr(
                  "Nhập mã bản quyền định dạng MVD-XXXX-XXXX-XXXX để cộng hạn sử dụng vào tài khoản của bạn.",
                  "Enter your license key (MVD-XXXX-XXXX-XXXX format) to extend validity on your account."
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">{tr("Mã License Key:", "License Key:")}</label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="MVD-XXXX-XXXX-XXXX"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-4 py-2.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isActivating || !manualKey.trim()}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {tr("Xác nhận kích hoạt", "Confirm Activation")}
              </button>
            </div>
          </form>
        )}

        {/* 5. ACTIVATE SUCCESS VIEW */}
        {mode === "activate_success" && (
          <div className="space-y-5 text-center py-6 relative select-none">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
            <div
              className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center justify-center gap-1.5">
                <span>{tr("Kích Hoạt Thành Công!", "Activation Successful!")}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{activateSuccessMsg}</p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMode("my_plan")}
                className="px-5 py-2 rounded-xl bg-muted/60 border border-border hover:bg-muted text-foreground font-semibold text-xs transition-all cursor-pointer"
              >
                {tr("Xem Gói Đang Dùng", "View Current Plan")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md cursor-pointer hover:bg-primary/90 transition-all"
              >
                {tr("Tiếp tục làm việc", "Continue Working")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs dark:bg-black/75 dark:backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>,
    document.body,
  );
}
