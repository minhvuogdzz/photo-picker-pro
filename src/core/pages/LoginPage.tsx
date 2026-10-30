import { useState, useEffect } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { login, getDeviceFingerprint, requestPasswordReset, verifyResetCode, resetPassword, register, verifyRegister } from "@/core/services/authApi";
import { ApiErrorResponse } from "@/core/services/apiClient";
import { forgetLoginPassword, loadLoginPassword, saveLoginPassword } from "@/core/services/savedCredentials";
import { Mail, Lock, Loader2, Eye, EyeOff, Camera, Sun, Moon, Monitor, ArrowLeft, CheckCircle2, User, RefreshCw } from "lucide-react";
import { FragmentedImageSlider } from "@/core/components/FragmentedImageSlider";
import { TermsDialog } from "@/core/components/TermsDialog";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { BrandLogo } from "@/core/components/BrandLogo";

type AuthMode = "login" | "forgot" | "verify" | "reset" | "success" | "register" | "register-verify";

export function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(() => localStorage.getItem("saved_login_account") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  // Prefill the remembered password from the OS keychain
  useEffect(() => {
    if (!rememberPassword || !email) return;
    let cancelled = false;
    void loadLoginPassword(email).then((saved) => {
      if (!cancelled && saved) setPassword((current) => current || saved);
    });
    return () => {
      cancelled = true;
    };
    // Only on mount: later edits to the email field must not pull another account's password
  }, []);

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
        void saveLoginPassword(email, password).catch((err) =>
          console.warn("Could not save password to keychain:", err)
        );
      } else {
        void forgetLoginPassword(email);
      }
      localStorage.setItem("saved_agree_terms", agreeTerms ? "true" : "false");
      localStorage.setItem("saved_auto_login", autoLogin ? "true" : "false");
      try {
        sessionStorage.removeItem("mvd_expiring_notice_dismissed");
      } catch {}

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
      const res = await register(email, cleanUsername);
      setResendCooldown(60);
      if (res && typeof res === 'object' && res.otp) {
        setCode(res.otp);
      }
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
      const res = await register(email, username.trim().toLowerCase());
      setResendCooldown(60);
      if (res && typeof res === 'object' && res.otp) {
        setCode(res.otp);
      }
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
      const res = await requestPasswordReset(email);
      setResendCooldown(60);
      if (res && typeof res === 'object' && res.otp) {
        setCode(res.otp);
      }
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
      const res = await requestPasswordReset(email);
      setResendCooldown(60);
      if (res && typeof res === 'object' && res.otp) {
        setCode(res.otp);
      }
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background relative overflow-hidden">
      {/* Left Side: Image Slider */}
      <div className="hidden lg:block lg:w-1/2 relative bg-black/20 min-h-screen">
        <FragmentedImageSlider />
      </div>

      {/* Right Side: Login Panel */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col relative overflow-hidden bg-background">
        {/* Smooth ambient gradient glow - eliminates WebKit blur tiling artifacts */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_520px_at_90%_10%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_480px_at_10%_50%,rgba(56,189,248,0.13),transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_480px_at_75%_90%,rgba(99,102,241,0.12),transparent_65%)]" />
        </div>

        {/* Brand header */}
        <div className="relative z-10 flex items-center justify-between px-6 sm:px-12 pt-7">
          <div className="flex items-center gap-3">
            <BrandLogo variant="icon" className="w-10 h-10 object-contain drop-shadow-sm" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-foreground tracking-tight">DH STUDIO PRO</h1>
              <span className="text-[11px] text-muted-foreground block">Devhouse Software</span>
            </div>
          </div>

          {/* Theme switcher (Light / Dark / System) */}
          <div role="group" aria-label="Giao diện" className="flex items-center gap-1 p-1 rounded-xl border border-border/80 bg-card/70 backdrop-blur-md shadow-sm">
            {([["light", Sun, "Giao diện Sáng"], ["dark", Moon, "Giao diện Tối"], ["system", Monitor, "Theo hệ thống"]] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={theme === key}
                onClick={() => updateSetting("theme", key)}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  theme === key 
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Center Container */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-12 py-8">
          <div className="w-full max-w-[420px] space-y-6 animate-fade-in relative">
            {mode !== "login" && mode !== "success" && (
              <button 
                type="button"
                onClick={() => switchMode("login")} 
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                title="Quay lại đăng nhập" aria-label="Quay lại đăng nhập"
              >
                <ArrowLeft size={15} /> Quay lại đăng nhập
              </button>
            )}

            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {mode === "login" && "Đăng nhập tài khoản"}
                {mode === "register" && "Đăng ký tài khoản mới"}
                {mode === "register-verify" && "Xác nhận và Hoàn tất"}
                {mode === "forgot" && "Khôi phục mật khẩu"}
                {mode === "verify" && "Xác nhận mã OTP"}
                {mode === "reset" && "Tạo mật khẩu mới"}
                {mode === "success" && "Hoàn tất"}
              </h2>
              {mode === "login" && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  Dùng tài khoản của bạn để sử dụng DH Studio Pro.
                </p>
              )}
            </div>

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4 animate-slide-up">
                <div className="space-y-1.5">
                  <label htmlFor="login-field-1" className="text-xs font-semibold text-foreground">Tài khoản (Username hoặc Email)</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input 
                      id="login-field-1" 
                      type="text" 
                      className="input-field !rounded-xl pl-10 text-sm" 
                      placeholder="Username hoặc email@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      autoFocus 
                      disabled={isSubmitting} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-field-2" className="text-xs font-semibold text-foreground">{t("password")}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input 
                      id="login-field-2" 
                      type={showPassword ? "text" : "password"} 
                      className="input-field !rounded-xl pl-10 pr-10 text-sm" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      minLength={6} 
                      disabled={isSubmitting} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} 
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5" 
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 animate-slide-up">
                    <p className="text-xs text-destructive font-medium">{error}</p>
                  </div>
                )}

                <div className="space-y-2.5 pt-1 animate-slide-up">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3.5">
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
                              void forgetLoginPassword(email);
                            }
                          }} 
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input cursor-pointer" 
                          disabled={isSubmitting} 
                        />
                        <span className="text-xs text-muted-foreground font-medium">Lưu mật khẩu</span>
                      </label>
                    </div>

                    <button 
                      type="button" 
                      className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium cursor-pointer" 
                      onClick={() => switchMode("forgot")}
                    >
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
                    <span className="text-xs text-muted-foreground font-medium">
                      Tôi đồng ý với các{" "}
                      <a 
                        href="#" 
                        className="text-primary hover:underline font-semibold" 
                        onClick={(e) => { e.preventDefault(); setShowTermsDialog(true); }}
                      >
                        Điều khoản & Dịch vụ
                      </a>
                    </span>
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting || !email || !password || !agreeTerms} 
                  className="btn-base btn-primary !rounded-xl w-full py-3 text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-primary/35 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <><Loader2 size={17} className="animate-spin inline mr-2" />{t("logging_in")}</>
                  ) : (
                    t("login")
                  )}
                </button>

                <div className="flex justify-center items-center text-center pt-1">
                  <p className="text-xs text-muted-foreground">
                    Chưa có tài khoản?{" "}
                    <button 
                      type="button" 
                      className="text-primary hover:underline font-semibold ml-1 cursor-pointer" 
                      onClick={() => switchMode("register")}
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                </div>
              </form>
            )}

            {mode === "login" && (
              <div className="pt-4 border-t border-border/60 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Hỗ trợ & Tiện ích</p>
                <ul className="space-y-2">
                  {([
                    [Camera, "Duyệt và chọn lọc ảnh dự án tốc độ cao"],
                    [CheckCircle2, "Đồng bộ tài khoản, giấy phép và cấu hình"],
                    [Lock, "Bảo mật thiết bị, chống đăng nhập trùng lặp"],
                  ] as const).map(([Icon, text]) => (
                    <li key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Icon size={13} />
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-5 animate-slide-up">
            <p className="text-sm text-muted-foreground text-center">
              Nhập tên tài khoản và email để nhận mã xác nhận kích hoạt tài khoản.
            </p>

            <div className="space-y-2">
              <label htmlFor="login-field-3" className="text-xs font-medium text-foreground ">Tên tài khoản / Your Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-3" 
                  type="text" 
                  className="input-field !rounded-xl pl-10" 
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
              <label htmlFor="login-field-4" className="text-xs font-medium text-foreground ">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-4" type="email" className="input-field !rounded-xl pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary bg-input cursor-pointer" disabled={isSubmitting} />
                <span className="text-xs text-muted-foreground font-medium">Tôi đồng ý với <a href="#" className="text-primary hover:underline font-semibold" onClick={(e) => { e.preventDefault(); setShowTermsDialog(true); }}>Điều khoản & Dịch vụ</a></span>
              </label>
            </div>

            {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email || !username || !agreeTerms} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
              <label htmlFor="login-field-5" className="text-xs font-medium text-foreground ">Mã OTP</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-5" type="text" maxLength={6} className="input-field !rounded-xl pl-10 text-center tracking-[0.5em] font-mono text-lg" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="login-field-6" className="text-xs font-medium text-foreground ">Họ và tên</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-6" type="text" className="input-field !rounded-xl pl-10" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-field-7" className="text-xs font-medium text-foreground ">Mật khẩu</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-7" type={showPassword ? "text" : "password"} className="input-field !rounded-xl pl-10 pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
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

            {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            
            <button type="submit" disabled={isSubmitting || code.length !== 6 || !name || password.length < 6} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
              <label htmlFor="login-field-8" className="text-xs font-medium text-foreground ">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-8" type="email" className="input-field !rounded-xl pl-10" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={isSubmitting} />
              </div>
            </div>
            {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || !email} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
              <label htmlFor="login-field-9" className="text-xs font-medium text-foreground ">Mã xác nhận OTP</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-9" type="text" maxLength={6} className="input-field !rounded-xl pl-10 text-center tracking-[0.5em] font-mono text-lg" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus disabled={isSubmitting} />
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

            {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || code.length !== 6} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin inline mr-2" />Đang kiểm tra...</> : "Xác nhận"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-5 animate-slide-up">
            <div className="space-y-2">
              <label htmlFor="login-field-10" className="text-xs font-medium text-foreground ">Mật khẩu mới</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input id="login-field-10" type={showPassword ? "text" : "password"} className="input-field !rounded-xl pl-10 pr-10" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoFocus disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-slide-up"><p className="text-xs text-destructive font-medium">{error}</p></div>}
            <button type="submit" disabled={isSubmitting || newPassword.length < 6} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
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
            <button type="button" onClick={() => switchMode("login")} className="btn-base btn-primary !rounded-xl w-full py-3.5 text-sm font-bold shadow-lg shadow-primary/20">
              Quay lại đăng nhập
            </button>
          </div>
        )}
          </div>
        </div>

        <p className="px-8 sm:px-12 pb-6 text-[11px] text-muted-foreground">© 2026 Devhouse Software.</p>
      </div>

      {showConflictDialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-LoginPage-1" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-sm p-6 space-y-6 text-center animate-fade-in shadow-2xl">
            <h2 id="dlg-LoginPage-1" className="text-lg font-bold text-foreground">Tài khoản đang được sử dụng</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tài khoản này đang được đăng nhập ở thiết bị khác. Bạn có muốn kick thiết bị kia ra và đăng nhập ở đây không?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-outline !rounded-xl flex-1 py-2 text-sm font-bold"
                onClick={() => setShowConflictDialog(false)}
                disabled={isSubmitting}
              >
                Bỏ qua
              </button>
              <button
                type="button"
                className="btn-primary !rounded-xl flex-1 py-2 text-sm font-bold"
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
