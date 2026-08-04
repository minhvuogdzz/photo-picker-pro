import { useState } from "react";
import { Key, Send, Loader2, X, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/core/services/apiClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { validateSubscription } from "@/core/services/authApi";

interface LicenseManagerProps {
  onClose: () => void;
}

type Mode = "select" | "activate" | "request" | "success";

export function LicenseManager({ onClose }: LicenseManagerProps) {
  const [mode, setMode] = useState<Mode>("select");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activate state
  const [key, setKey] = useState("");

  // Request state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/license/activate", {
        method: "POST",
        body: { key },
        accessToken: session?.accessToken
      });
      // Refresh session
      if (session) {
        const updated = await validateSubscription(session);
        setSession(updated);
      }
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
        body: { name, phone, email },
        accessToken: session?.accessToken
      });
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-80 panel p-4 z-50 animate-slide-up shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-sm font-bold mb-4 flex items-center gap-1.5">
          <Key size={14} className="text-primary" />
          Đổi Quyền Lợi
        </h2>

        {mode === "select" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-4">
              Vui lòng chọn thao tác bạn muốn thực hiện.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("request")}
                className="panel p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-accent/50 hover:border-primary/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Send size={14} className="text-blue-500" />
                </div>
                <span className="font-semibold text-[11px] uppercase">Lấy Key</span>
              </button>

              <button
                onClick={() => setMode("activate")}
                className="panel p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-accent/50 hover:border-primary/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Key size={14} className="text-green-500" />
                </div>
                <span className="font-semibold text-[11px] uppercase">Kích Hoạt</span>
              </button>
            </div>
          </div>
        )}

        {mode === "activate" && (
          <form onSubmit={handleActivate} className="space-y-3 animate-fade-in">
            <p className="text-xs text-muted-foreground">
              Nhập mã bản quyền 16 chữ số.
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">License Key</label>
              <input
                type="text"
                className="input-field font-mono text-center tracking-widest text-sm py-2 uppercase"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {error && <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-[11px] text-destructive font-medium">{error}</p></div>}
            
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => {setMode("select"); setError(null);}} className="btn-outline flex-1 py-1.5 text-xs">Quay lại</button>
              <button type="submit" disabled={isSubmitting || !key} className="btn-primary flex-1 py-1.5 text-xs">
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : "Kích hoạt"}
              </button>
            </div>
          </form>
        )}

        {mode === "request" && (
          <form onSubmit={handleRequest} className="space-y-3 animate-fade-in">
            <p className="text-xs text-muted-foreground">
              Để lại thông tin để chúng tôi liên hệ tư vấn.
            </p>
            
            <div className="space-y-2">
              <input
                type="text"
                className="input-field text-sm py-1.5 px-3"
                placeholder="Họ và tên"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                autoFocus
              />
              <input
                type="tel"
                className="input-field text-sm py-1.5 px-3"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isSubmitting}
              />
              <input
                type="email"
                className="input-field text-sm py-1.5 px-3"
                placeholder="Email liên hệ"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {error && <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-[11px] text-destructive font-medium">{error}</p></div>}
            
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => {setMode("select"); setError(null);}} className="btn-outline flex-1 py-1.5 text-xs">Quay lại</button>
              <button type="submit" disabled={isSubmitting || !name || !phone || !email} className="btn-primary flex-1 py-1.5 text-xs">
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        )}

        {mode === "success" && (
          <div className="space-y-4 text-center animate-fade-in py-2">
            <div className="flex justify-center text-green-500">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h3 className="text-base font-bold mb-1">Thành công!</h3>
              <p className="text-xs text-muted-foreground">
                Thao tác của bạn đã hoàn tất. 
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full py-2 text-xs">
              Đóng cửa sổ
            </button>
          </div>
        )}
      </div>
    </>
  );
}
