import { useState } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { login, getDeviceFingerprint, requestPasswordReset, verifyResetCode, resetPassword, register, verifyRegister } from "@/core/services/authApi";
import { Mail, Lock, Loader2, Eye, EyeOff, Camera, ArrowLeft, CheckCircle2, User } from "lucide-react";
import { FragmentedImageSlider } from "@/core/components/FragmentedImageSlider";

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

  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  const handleLogin = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const session = await login({ email, password, deviceFingerprint, force }, autoLogin);
      setSession(session);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('đang được đăng nhập ở thiết bị khác')) {
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
                <span className="text-xs text-muted-foreground font-medium">Tôi đồng ý với các <a href="#" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); setShowTermsDialog(true); }}>điều khoản và dịch vụ</a></span>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-3xl bg-card/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl flex flex-col max-h-[85vh] animate-slide-up">
            <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-foreground">Điều khoản và Dịch vụ</h2>
              <button onClick={() => setShowTermsDialog(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 text-sm text-muted-foreground leading-relaxed custom-scrollbar">
              
              {/* PHẦN TIẾNG VIỆT */}
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <p className="font-bold text-foreground text-lg uppercase tracking-wide">MVD PHOTOSHOP ACADEMY</p>
                  <p className="text-primary font-semibold">THỎA THUẬN CUNG CẤP VÀ SỬ DỤNG DỊCH VỤ (TERMS OF SERVICE)</p>
                  <p className="text-xs mt-2">Cập nhật lần cuối: Tháng 8/2026</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 1: Chấp nhận điều khoản</h3>
                  <p>Bằng việc đăng ký, đăng nhập và sử dụng phần mềm MVD Photoshop Academy, bạn (Người dùng) xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi các điều khoản, điều kiện này. Nếu bạn không đồng ý với bất kỳ phần nào của thỏa thuận, vui lòng ngưng sử dụng dịch vụ và gỡ cài đặt phần mềm ngay lập tức.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 2: Giấy phép sử dụng & Quyền Sở Hữu Trí Tuệ</h3>
                  <p>2.1. MVD Photoshop Academy cấp cho bạn một giấy phép không độc quyền, không thể chuyển nhượng, và có thể thu hồi để sử dụng phần mềm cho mục đích cá nhân hoặc thương mại (tùy thuộc vào gói dịch vụ bạn đã mua).</p>
                  <p>2.2. Toàn bộ nội dung, bộ lọc ảnh (presets), thuật toán, mã nguồn, đồ họa, logo và tài liệu hướng dẫn thuộc sở hữu độc quyền của MVD, được bảo vệ bởi luật Sở hữu trí tuệ Việt Nam và quốc tế.</p>
                  <p>2.3. Nghiêm cấm mọi hành vi sao chép, phát tán, bán lại, cho thuê tài khoản hoặc sử dụng công nghệ biên dịch ngược (reverse engineering) đối với bất kỳ thành phần nào của phần mềm.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 3: Trách Nhiệm Người Dùng & Các Hành Vi Bị Cấm</h3>
                  <p>3.1. Người dùng có trách nhiệm bảo mật thông tin tài khoản (Tên đăng nhập, Mật khẩu). Mọi hành vi truy cập từ tài khoản của bạn sẽ được xem là do chính bạn thực hiện và chịu trách nhiệm.</p>
                  <p>3.2. Chúng tôi có hệ thống phát hiện chia sẻ tài khoản (multi-device login/account sharing). Việc cố tình share tài khoản cho nhiều người sử dụng vi phạm chính sách của chúng tôi và sẽ dẫn đến việc tài khoản bị khóa vĩnh viễn không cần báo trước, đồng thời không được hoàn tiền.</p>
                  <p>3.3. Cấm sử dụng phần mềm để chỉnh sửa, tạo ra hoặc phát tán nội dung vi phạm pháp luật, đồi trụy, thù địch, hoặc xâm phạm quyền riêng tư/bản quyền của bên thứ ba.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 4: Thanh Toán, Gia Hạn & Hoàn Tiền</h3>
                  <p>4.1. Dịch vụ được cung cấp dựa trên các gói thuê bao (subscription). Phí dịch vụ phải được thanh toán trước qua các cổng thanh toán được hệ thống hỗ trợ.</p>
                  <p>4.2. Khách hàng có trách nhiệm tự quản lý việc gia hạn. Dịch vụ có thể bị tạm ngưng nếu quá trình thanh toán gia hạn không thành công.</p>
                  <p>4.3. <b>Chính sách hoàn tiền:</b> MVD Photoshop Academy cung cấp sản phẩm nội dung số. Chúng tôi KHÔNG HỖ TRỢ HOÀN TIỀN cho các giao dịch đã thực hiện thành công, ngoại trừ trường hợp lỗi kỹ thuật nghiêm trọng xuất phát từ phía phần mềm khiến bạn không thể sử dụng dịch vụ trong suốt 7 ngày liên tục kể từ lúc mua.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 5: Thu Thập Và Bảo Mật Dữ Liệu</h3>
                  <p>5.1. Chúng tôi cam kết tôn trọng quyền riêng tư của bạn. Dữ liệu hình ảnh của bạn chỉ được xử lý cục bộ trên thiết bị của bạn hoặc mã hóa an toàn trên máy chủ đám mây của chúng tôi. MVD Academy không lưu trữ vĩnh viễn và không phân tích hình ảnh của khách hàng phục vụ mục đích khác.</p>
                  <p>5.2. Thông tin cá nhân (Email, Tên, Định danh thiết bị phần cứng) chỉ được thu thập nhằm mục đích xác thực tài khoản, chống gian lận và hỗ trợ kỹ thuật.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 6: Tuyên Bố Từ Chối Bảo Đảm & Giới Hạn Trách Nhiệm</h3>
                  <p>6.1. Phần mềm được cung cấp ở trạng thái "nguyên bản" (AS IS) và "có sẵn" (AS AVAILABLE). MVD không đảm bảo phần mềm sẽ tương thích 100% với mọi cấu hình phần cứng hoặc hoạt động không có bất kỳ lỗi nhỏ nào.</p>
                  <p>6.2. Trong mọi trường hợp, MVD Academy, bao gồm cả ban giám đốc, nhân viên, và đối tác, sẽ không chịu trách nhiệm đối với bất kỳ thiệt hại gián tiếp, mất mát dữ liệu, mất mát dự án cá nhân hoặc tổn thất lợi nhuận nào phát sinh từ việc sử dụng hoặc không thể sử dụng phần mềm.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 7: Chấm Dứt Dịch Vụ</h3>
                  <p>Chúng tôi bảo lưu quyền đình chỉ hoặc chấm dứt tài khoản của bạn ngay lập tức, không cần thông báo trước, nếu phát hiện bạn vi phạm bất kỳ điều khoản nào trong Thỏa thuận này (đặc biệt là hành vi chia sẻ tài khoản hoặc sử dụng phần mềm bất hợp pháp).</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 8: Sửa Đổi Điều Khoản</h3>
                  <p>MVD Photoshop Academy có quyền sửa đổi các điều khoản này bất cứ lúc nào. Các thay đổi sẽ có hiệu lực ngay khi được cập nhật trên hệ thống. Việc bạn tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận các điều khoản mới nhất.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Điều 9: Luật Áp Dụng & Giải Quyết Tranh Chấp</h3>
                  <p>Thỏa thuận này được điều chỉnh và giải thích theo luật pháp của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh từ hoặc liên quan đến thỏa thuận này sẽ được ưu tiên giải quyết thông qua thương lượng hòa bình.</p>
                </div>
              </div>

              {/* PHẦN TIẾNG ANH (ENGLISH TRANSLATION) */}
              <div className="space-y-6 pt-8 border-t border-white/20 mt-8">
                <div className="border-b border-white/10 pb-4">
                  <p className="font-bold text-foreground text-lg uppercase tracking-wide">ENGLISH VERSION</p>
                  <p className="text-primary font-semibold">TERMS OF SERVICE AGREEMENT</p>
                  <p className="text-xs mt-2">Last Updated: August 2026</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 1: Acceptance of Terms</h3>
                  <p>By registering, logging in, and using the MVD Photoshop Academy software, you (the User) acknowledge that you have read, understood, and agreed to be bound by these terms and conditions. If you do not agree with any part of this agreement, please discontinue the use of our services immediately.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 2: License to Use & Intellectual Property</h3>
                  <p>2.1. MVD Photoshop Academy grants you a non-exclusive, non-transferable, and revocable license to use the software for personal or commercial purposes (depending on your purchased subscription tier).</p>
                  <p>2.2. All content, photo presets, algorithms, source code, graphics, logos, and documentation are the exclusive property of MVD and are protected by Vietnamese and international intellectual property laws.</p>
                  <p>2.3. Strictly prohibited actions include copying, distributing, reselling, account renting, or reverse engineering any component of the software.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 3: User Responsibilities & Prohibited Conduct</h3>
                  <p>3.1. Users are responsible for maintaining the confidentiality of their account information (Username, Password). Any access from your account is deemed to be performed and authorized by you.</p>
                  <p>3.2. We utilize an automated system to detect account sharing (multi-device login). Intentional sharing of your account with multiple users violates our policy and will result in a permanent ban without prior notice and without a refund.</p>
                  <p>3.3. It is prohibited to use the software to edit, create, or distribute content that is illegal, explicit, hateful, or infringes upon the privacy or copyright of third parties.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 4: Payment, Renewal & Refunds</h3>
                  <p>4.1. Services are provided on a subscription basis. Service fees must be paid in advance via our supported payment gateways.</p>
                  <p>4.2. Customers are responsible for managing their renewals. Services may be suspended if a renewal payment fails.</p>
                  <p>4.3. <b>Refund Policy:</b> MVD Photoshop Academy provides digital software products. We DO NOT OFFER REFUNDS for successful transactions, except in cases where a critical technical failure on our end prevents you from using the service for 7 consecutive days from the time of purchase.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 5: Data Collection & Privacy</h3>
                  <p>5.1. We respect your privacy. Your image data is processed locally on your device or securely encrypted on our cloud servers. MVD Academy does not permanently store or analyze your images for any other purposes.</p>
                  <p>5.2. Personal information (Email, Name, Hardware Device ID) is collected solely for account authentication, fraud prevention, and technical support.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 6: Disclaimer of Warranties & Limitation of Liability</h3>
                  <p>6.1. The software is provided "AS IS" and "AS AVAILABLE". MVD does not guarantee that the software will be 100% compatible with all hardware configurations or operate completely bug-free.</p>
                  <p>6.2. Under no circumstances shall MVD Academy, its directors, employees, or affiliates be liable for any indirect damages, data loss, personal project loss, or profit loss arising from the use or inability to use the software.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 7: Termination of Service</h3>
                  <p>We reserve the right to suspend or terminate your account immediately, without prior notice, if we discover that you have violated any terms in this Agreement (especially regarding account sharing or illegal software usage).</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 8: Modifications to Terms</h3>
                  <p>MVD Photoshop Academy reserves the right to modify these terms at any time. Changes will take effect immediately upon being updated in the system. Your continued use of the service signifies your acceptance of the latest terms.</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-foreground">Article 9: Governing Law</h3>
                  <p>This agreement is governed by and construed in accordance with the laws of the Socialist Republic of Vietnam. Any disputes arising from or relating to this agreement shall be prioritized for resolution through amicable negotiation.</p>
                </div>
              </div>

              {/* Action Button Fixed at Bottom of Scroll */}
              <div className="pt-8 mt-4 pb-2 border-t border-white/10 flex justify-end sticky bottom-0 bg-card/95 backdrop-blur-md">
                <button 
                  type="button" 
                  className="btn-primary py-3.5 px-8 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg"
                  onClick={() => {
                    setAgreeTerms(true);
                    setShowTermsDialog(false);
                  }}
                >
                  <CheckCircle2 size={18} />
                  Tôi đã đọc và Đồng ý (I Agree)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
