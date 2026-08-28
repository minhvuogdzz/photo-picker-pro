import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Key, Send, Loader2, X, CheckCircle2, Crown } from "lucide-react";
import { apiRequest } from "@/core/services/apiClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { validateSubscription } from "@/core/services/authApi";

interface LicenseManagerProps {
  onClose: () => void;
  initialMode?: "select" | "activate" | "request";
  initialIsPremium?: boolean;
  variant?: "dropdown" | "modal";
}

type Mode = "select" | "activate" | "request" | "success";

export function LicenseManager({
  onClose,
  initialMode = "select",
  initialIsPremium = false,
  variant = "dropdown",
}: LicenseManagerProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Activate state
  const [key, setKey] = useState("");

  // Request state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPremium, setIsPremium] = useState(initialIsPremium);

  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>("/license/activate", {
        method: "POST",
        body: { key: key.trim().toUpperCase() },
        accessToken: session?.accessToken,
      });

      // Refresh session immediately
      if (session) {
        const updated = await validateSubscription(session);
        setSession(updated);
      }
      setSuccessMessage(res.message || "Kích hoạt mã bản quyền thành công!");
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/license/request", {
        method: "POST",
        body: { name, phone, email, isPremium },
        accessToken: session?.accessToken,
      });
      setSuccessMessage(
        isPremium
          ? "Đã gửi yêu cầu cấp Key VIP Premium tới Admin. Chúng tôi sẽ liên hệ sớm nhất!"
          : "Đã gửi yêu cầu cấp Key thành công. Chúng tôi sẽ liên hệ với bạn sớm nhất!"
      );
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared Inner Form Content
  const renderContent = () => (
    <>
      <button
        onClick={onClose}
        className="absolute right-3.5 top-3.5 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 active:scale-95 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-150 cursor-pointer transform-gpu"
        title="Đóng"
      >
        <X size={13} />
      </button>

      <div className="flex items-center gap-2 mb-3.5">
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
          <Key size={14} />
        </div>
        <div>
          <h2 className="text-xs font-bold text-foreground">Đổi Quyền Lợi & Cấp Bản Quyền</h2>
          <p className="text-[9px] text-muted-foreground">MVD Photoshop Academy</p>
        </div>
      </div>

      {mode === "select" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vui lòng chọn thao tác bạn muốn thực hiện:
          </p>
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <button
              onClick={() => {
                setMode("request");
                setError(null);
              }}
              className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted active:scale-[0.98] border border-border hover:border-blue-500/40 flex flex-col items-center justify-center gap-2 transition-all duration-150 group cursor-pointer transform-gpu shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Send size={14} />
              </div>
              <div className="text-center">
                <span className="font-bold text-xs block text-foreground">Yêu Cầu Key</span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Đăng ký bản quyền / VIP</span>
              </div>
            </button>

            <button
              onClick={() => {
                setMode("activate");
                setError(null);
              }}
              className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted active:scale-[0.98] border border-border hover:border-emerald-500/40 flex flex-col items-center justify-center gap-2 transition-all duration-150 group cursor-pointer transform-gpu shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Key size={14} />
              </div>
              <div className="text-center">
                <span className="font-bold text-xs block text-foreground">Kích Hoạt Key</span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Nhập mã đã được cấp</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {mode === "activate" && (
        <form onSubmit={handleActivate} className="space-y-3 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            Nhập mã bản quyền 16 ký tự do Admin cấp:
          </p>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              Mã License Key
            </label>
            <input
              type="text"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center font-mono font-bold tracking-widest text-xs uppercase text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/60 transition-colors shadow-sm"
              placeholder="MVD-XXXX-XXXX-XXXX"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 animate-slide-up">
              <p className="text-[11px] text-rose-500 font-medium">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("select");
                setError(null);
              }}
              className="flex-1 h-9 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-all duration-150 cursor-pointer transform-gpu"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !key}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-xs shadow-md shadow-amber-500/25 transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transform-gpu"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : "Kích hoạt"}
            </button>
          </div>
        </form>
      )}

      {mode === "request" && (
        <form onSubmit={handleRequest} className="space-y-2.5 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            Để lại thông tin để chúng tôi liên hệ cấp Key:
          </p>

          <div className="space-y-2">
            <input
              type="text"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
              placeholder="Họ và tên của bạn *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              autoFocus
            />
            <input
              type="tel"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
              placeholder="Số điện thoại Zalo *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <input
              type="email"
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
              placeholder="Email tài khoản *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Checkbox Đăng ký Premium */}
          <label className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 cursor-pointer hover:bg-amber-500/15 transition-colors">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
            />
            <div className="text-left space-y-0.5">
              <div className="flex items-center gap-1">
                <Crown size={12} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-500">Đăng ký VIP Premium</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">
                Mở khóa trọn bộ <strong>Kho Tài Nguyên Creative</strong> & đặc quyền VIP.
              </p>
            </div>
          </label>

          {error && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 animate-slide-up">
              <p className="text-[11px] text-rose-500 font-medium">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setMode("select");
                setError(null);
              }}
              className="flex-1 h-9 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-all duration-150 cursor-pointer transform-gpu"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !phone || !email}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-110 active:scale-[0.98] text-white font-extrabold text-xs shadow-md shadow-blue-500/25 transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transform-gpu"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : "Gửi yêu cầu"}
            </button>
          </div>
        </form>
      )}

      {mode === "success" && (
        <div className="space-y-3 text-center animate-fade-in py-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground mb-1">Thao tác thành công!</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {successMessage || "Yêu cầu của bạn đã được tiếp nhận và xử lý."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-xs shadow-md shadow-emerald-500/25 transition-all duration-150 cursor-pointer transform-gpu"
          >
            Đóng
          </button>
        </div>
      )}
    </>
  );

  // Variant 1: Dropdown popover dropping down right underneath Header button
  if (variant === "dropdown") {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div className="absolute right-0 top-full mt-2 w-84 bg-card/95 backdrop-blur-2xl border border-border rounded-2xl p-4 z-50 animate-slide-up shadow-2xl text-foreground">
          {renderContent()}
        </div>
      </>
    );
  }

  // Variant 2: Full centered modal dialog for in-app features (Kho Tài Nguyên, etc.)
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl relative z-10 animate-scale-in text-foreground">
        {renderContent()}
      </div>
    </div>,
    document.body
  );
}
