import { useState, useEffect } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { login, getDeviceFingerprint, requestPasswordReset, verifyResetCode, resetPassword, register, verifyRegister } from "@/core/services/authApi";
import { ApiErrorResponse } from "@/core/services/apiClient";
import { Mail, Lock, Loader2, Eye, EyeOff, Camera, ArrowLeft, CheckCircle2, User, RefreshCw } from "lucide-react";
import { FragmentedImageSlider } from "@/core/components/FragmentedImageSlider";
import { TermsDialog } from "@/core/components/TermsDialog";

type AuthMode = "login" | "forgot" | "verify" | "reset" | "success" | "register" | "register-verify";

export function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useTranslation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(() => localStorage.getItem("saved_login_account") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(() => {
    const rememberPass = localStorage.getItem("saved_remember_password") !== "false";
    return rememberPass ? (localStorage.getItem("saved_login_password") || "") : "";
  });
  const [rememberPassword, setRememberPassword] = useState(() => localStorage.getItem("saved_remember_password") !== "false");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [autoLogin, setAutoLogin] = useState(() => localStorage.getItem("saved_auto_login") !== "false");
  const [agreeTerms, setAgreeTerms] = useState(() => localStorage.getItem("saved_agree_terms") === "true");
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend OTP countdown (60s)
  const [resendCooldown, setResendCooldown] = useState(0);

  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  // Sync mode with URL hash if redirected from SessionExpiredDialog or external links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "forgot-password" || hash === "forgot") {
        setMode("forgot");
        setError(null);
      } else if (hash === "register") {
        setMode("register");
        setError(null);
      } else if (hash === "login") {
        setMode("login");
        setError(null);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Countdown timer effect for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    if (nextMode === "login") {
      setPassword("");
      setCode("");
      setNewPassword("");
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } else if (nextMode === "register") {
      setCode("");
      setPassword("");
    } else if (nextMode === "forgot") {
      setCode("");
      setNewPassword("");
    }
  };

  const handleLogin = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const session = await login({ email, password, deviceFingerprint, force }, autoLogin);

      // Lưu thông tin tài khoản và cấu hình đã nhập
      localStorage.setItem("saved_login_account", email);
      localStorage.setItem("saved_remember_password", rememberPassword ? "true" : "false");
      if (rememberPassword) {
        localStorage.setItem("saved_login_password", password);
      } else {
        localStorage.removeItem("saved_login_password");
      }
      localStorage.setItem("saved_agree_terms", agreeTerms ? "true" : "false");
      localStorage.setItem("saved_auto_login", autoLogin ? "true" : "false");

      setSession(session);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isConflict = (err instanceof ApiErrorResponse && (err.statusCode === 409 || err.errorCode === 'DEVICE_CONFLICT')) ||
        (err as any)?.statusCode === 409 ||
        errMsg.includes('đang được đăng nhập ở thiết bị khác');

      if (isConflict) {
        setShowConflictDialog(true);
      } else {
        setError(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError("Vui lòng nhập tên tài khoản của bạn (Username)");
      return;
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      setError("Tên tài khoản phải từ 3 đến 30 ký tự, viết liền không dấu (chỉ gồm chữ, số, ., _, -)");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, cleanUsername);
      setResendCooldown(60);
      switchMode("register-verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, username.trim().toLowerCase());
      setResendCooldown(60);
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
      const session = await verifyRegister({ 
        email, 
        username: username.trim().toLowerCase(), 
        password, 
        name, 
        code, 
        deviceFingerprint 
      });
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
      setResendCooldown(60);
      switchMode("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendForgotPasswordOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setResendCooldown(60);
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
        switchMode("reset");
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
      switchMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F19] relative overflow-hidden p-4 sm:p-8">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[40%] bg-rose-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      {/* Main Split Card */}
      <div className="w-full max-w-5xl xl:max-w-6xl min-h-[600px] xl:min-h-[700px] flex flex-col lg:flex-row bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative z-10 overflow-hidden">
        
        {/* Left Side: Image Slider */}
        <div className="w-full lg:w-1/2 relative hidden lg:block bg-black/20">
           <FragmentedImageSlider />
        </div>

        {/* Right Side: Login Panel */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
           <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
        {mode !== "login" && mode !== "success" && (
          <button 
            type="button"
            onClick={() => switchMode("login")} 
            className="absolute top-6 left-6 text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Quay lại đăng nhập"
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tên tài khoản hoặc Email</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" className="input-field pl-10" placeholder="username hoặc email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={autoLogin} 
                      onChange={(e) => {
                        setAutoLogin(e.target.checked);
                        localStorage.setItem("saved_auto_login", e.target.checked ? "true" : "false");
                      }} 
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input cursor-pointer" 
                      disabled={isSubmitting} 
                    />
                    <span className="text-xs text-muted-foreground font-medium">Tự động đăng nhập</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rememberPassword} 
                      onChange={(e) => {
                        setRememberPassword(e.target.checked);
                        localStorage.setItem("saved_remember_password", e.target.checked ? "true" : "false");
                        if (!e.target.checked) {
                          localStorage.removeItem("saved_login_password");
                        }
                      }} 
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input cursor-pointer" 
                      disabled={isSubmitting} 
                    />
                    <span className="text-xs text-muted-foreground font-medium">Lưu mật khẩu</span>
                  </label>
                </div>

                <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium cursor-pointer" onClick={() => switchMode("forgot")}>
                  {t("forgot_password")}
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={agreeTerms} 
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    localStorage.setItem("saved_agree_terms", e.target.checked ? "true" : "false");
                  }} 
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input cursor-pointer" 
                  disabled={isSubmitting} 
                />
                <span className="text-xs text-muted-foreground font-medium">Tôi đồng ý với các <a href="#" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); setShowTermsDialog(true); }}>Điều khoản & Dịch vụ</a></span>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting || !email || !password || !agreeTerms} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />{t("logging_in")}</> : t("login")}
            </button>

            <div className="flex justify-center items-center text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Chưa có tài khoản?{" "}
                <button type="button" className="text-primary hover:underline font-semibold ml-1" onClick={() => switchMode("register")}>
                  Đăng ký ngay
                </button>
              </p>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Nhập tên tài khoản và email để nhận mã xác nhận kích hoạt tài khoản.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tên tài khoản / Your Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  className="input-field pl-10" 
                  placeholder="vd: hoanghan03, nguyenvana..." 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))} 
                  required 
                  minLength={3}
                  maxLength={30}
                  autoFocus
                  disabled={isSubmitting} 
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Từ 3-30 ký tự, viết liền không dấu (dùng để đăng nhập thay email).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" className="input-field pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input" disabled={isSubmitting} />
                <span className="text-xs text-muted-foreground font-medium">Tôi đồng ý với <a href="#" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); setShowTermsDialog(true); }}>Điều khoản & Dịch vụ</a></span>
              </label>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email || !username || !agreeTerms} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang gửi mã...</> : "Tiếp tục"}
            </button>
          </form>
        )}

        {mode === "register-verify" && (
          <form onSubmit={handleVerifyRegister} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Mã xác nhận 6 chữ số đã gửi tới <b>{email}</b> cho tài khoản <b>@{username}</b>.
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResendRegisterOtp}
                disabled={resendCooldown > 0 || isSubmitting}
                className="text-xs text-primary hover:underline disabled:text-muted-foreground flex items-center gap-1 font-medium"
              >
                <RefreshCw size={12} className={isSubmitting ? "animate-spin" : ""} />
                {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : "Gửi lại mã OTP"}
              </button>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            
            <button type="submit" disabled={isSubmitting || code.length !== 6 || !name || password.length < 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang đăng ký...</> : "Đăng ký & Đăng nhập"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Nhập email của bạn để nhận mã xác nhận gồm 6 chữ số khôi phục mật khẩu.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" className="input-field pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang gửi mã...</> : "Gửi mã xác nhận"}
            </button>
          </form>
        )}

        {mode === "verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Mã xác nhận đã được gửi tới <b>{email}</b>. Vui lòng kiểm tra hộp thư (và thư mục rác).
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mã xác nhận OTP</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" maxLength={6} className="input-field pl-10 text-center tracking-[0.5em] font-mono text-lg" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResendForgotPasswordOtp}
                disabled={resendCooldown > 0 || isSubmitting}
                className="text-xs text-primary hover:underline disabled:text-muted-foreground flex items-center gap-1 font-medium"
              >
                <RefreshCw size={12} className={isSubmitting ? "animate-spin" : ""} />
                {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : "Gửi lại mã xác nhận"}
              </button>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || code.length !== 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
            <button type="submit" disabled={isSubmitting || newPassword.length < 6} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
            <button type="button" onClick={() => switchMode("login")} className="btn-base btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              Quay lại đăng nhập
            </button>
          </div>
        )}
        </div>

      </div>
      </div>
      
      {showConflictDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-sm p-6 space-y-6 text-center animate-fade-in shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Tài khoản đang được sử dụng</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tài khoản này đang được đăng nhập ở thiết bị khác. Bạn có muốn kick thiết bị kia ra và đăng nhập ở đây không?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-outline flex-1 py-2 text-sm font-bold"
                onClick={() => setShowConflictDialog(false)}
                disabled={isSubmitting}
              >
                Bỏ qua
              </button>
              <button
                type="button"
                className="btn-primary flex-1 py-2 text-sm font-bold"
                onClick={() => handleLogin(undefined, true)}
                disabled={isSubmitting}
              >
                Xác nhận kick ra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Services Dialog */}
      {showTermsDialog && (
        <TermsDialog
          onClose={() => setShowTermsDialog(false)}
          onAgree={() => setAgreeTerms(true)}
          showAgreeButton={true}
        />
      )}
    </div>
  );
}
