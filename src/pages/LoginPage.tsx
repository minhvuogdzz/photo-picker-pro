import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTranslation } from "@/lib/i18n";
import { login, getDeviceFingerprint, requestPasswordReset, verifyResetCode, resetPassword, register, verifyRegister } from "@/services/authApi";
import { Mail, Lock, Loader2, Eye, EyeOff, Camera, ArrowLeft, CheckCircle2, User } from "lucide-react";

type AuthMode = "login" | "forgot" | "verify" | "reset" | "success" | "register" | "register-verify";

export function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useTranslation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [autoLogin, setAutoLogin] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const session = await login({ email, password, deviceFingerprint }, autoLogin);
      setSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email);
      setMode("register-verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const session = await verifyRegister({ email, password, name, code, deviceFingerprint });
      setSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setMode("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const valid = await verifyResetCode(email, code);
      if (valid) {
        setMode("reset");
      } else {
        setError("Mã xác nhận không đúng hoặc đã hết hạn.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(email, code, newPassword);
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-info/5 rounded-full blur-3xl" />
      </div>

      <div className="panel w-full max-w-md p-8 space-y-8 relative animate-fade-in">
        {mode !== "login" && mode !== "success" && (
          <button 
            onClick={() => {
              setMode("login");
              setError(null);
            }} 
            className="absolute top-6 left-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-14 h-14 object-contain drop-shadow-md"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement?.classList.add("fallback-icon");
              }}
            />
            <Camera size={32} className="text-primary hidden" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gradient">MVD PHOTOSHOP ACADEMY</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" && t("login_subtitle")}
              {mode === "register" && "Đăng ký tài khoản mới"}
              {mode === "register-verify" && "Xác nhận và Hoàn tất"}
              {mode === "forgot" && "Khôi phục mật khẩu"}
              {mode === "verify" && "Xác nhận mã OTP"}
              {mode === "reset" && "Tạo mật khẩu mới"}
              {mode === "success" && "Hoàn tất"}
            </p>
          </div>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-5 animate-slide-up">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email / Tài khoản</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" className="input-field pl-10" placeholder="email@example.com hoặc admin" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("password")}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} className="input-field pl-10 pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}

            <div className="space-y-3 pb-1 animate-slide-up">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoLogin} onChange={(e) => setAutoLogin(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input" disabled={isSubmitting} />
                <span className="text-xs text-muted-foreground font-medium">Tự động đăng nhập</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input" disabled={isSubmitting} />
                <span className="text-xs text-muted-foreground font-medium">Tôi đồng ý với các <a href="#" className="text-primary hover:underline" onClick={(e) => e.preventDefault()}>điều khoản và dịch vụ</a></span>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting || !email || !password || !agreeTerms} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />{t("logging_in")}</> : t("login")}
            </button>
            <div className="flex justify-between items-center text-center">
              <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium" onClick={() => setMode("register")}>
                Đăng ký tài khoản
              </button>
              <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium" onClick={() => setMode("forgot")}>
                {t("forgot_password")}
              </button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Nhập email của bạn để nhận mã xác nhận và đăng ký.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" className="input-field pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang gửi...</> : "Tiếp tục"}
            </button>
          </form>
        )}

        {mode === "register-verify" && (
          <form onSubmit={handleVerifyRegister} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Mã xác nhận đã được gửi tới <b>{email}</b>.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mã OTP</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" maxLength={6} className="input-field pl-10 text-center tracking-[0.5em] font-mono text-lg" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Họ và tên</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" className="input-field pl-10" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} className="input-field pl-10 pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            
            <button type="submit" disabled={isSubmitting || code.length !== 6 || !name || password.length < 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang đăng ký...</> : "Đăng ký & Đăng nhập"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Nhập email của bạn để nhận mã xác nhận gồm 6 chữ số.
            </p>
            <div className="space-y-2">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" className="input-field pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang gửi...</> : "Gửi mã xác nhận"}
            </button>
          </form>
        )}

        {mode === "verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Mã xác nhận đã được gửi tới <b>{email}</b>. Vui lòng kiểm tra hộp thư (và thư mục rác).
            </p>
            <div className="space-y-2">
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" maxLength={6} className="input-field pl-10 text-center tracking-[0.5em] font-mono text-lg" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || code.length !== 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang kiểm tra...</> : "Xác nhận"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-5 animate-slide-up">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mật khẩu mới</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} className="input-field pl-10 pr-10" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoFocus disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || newPassword.length < 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang đổi mật khẩu...</> : "Lưu mật khẩu mới"}
            </button>
          </form>
        )}

        {mode === "success" && (
          <div className="space-y-5 animate-slide-up text-center">
            <div className="flex justify-center mb-4 text-green-500">
              <CheckCircle2 size={48} />
            </div>
            <p className="text-sm font-medium">Mật khẩu của bạn đã được thay đổi thành công!</p>
            <button type="button" onClick={() => { setMode("login"); setPassword(""); setCode(""); }} className="btn-base btn-primary w-full py-3.5 text-sm font-bold">
              Quay lại đăng nhập
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
