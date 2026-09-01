import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { updateProfile, changePassword, logoutOtherDevices } from "@/core/services/authApi";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  User,
  Shield,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
  Save,
  Crown,
} from "lucide-react";

interface AccountSecurityModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type TabType = "profile" | "password" | "devices";

export function AccountSecurityModal({ isOpen, onClose }: AccountSecurityModalProps) {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile edit state
  const [username, setUsername] = useState(session?.username || session?.email.split("@")[0] || "");
  const [name, setName] = useState(session?.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Devices state
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state when session changes
  useEffect(() => {
    if (session) {
      setUsername(session.username || session.email.split("@")[0] || "");
      setName(session.name || "");
    }
  }, [session, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !session) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setProfileMessage({ type: "error", text: "Tên tài khoản không được để trống." });
      return;
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      setProfileMessage({
        type: "error",
        text: "Tên tài khoản từ 3-30 ký tự, viết liền không dấu (chỉ gồm chữ, số, ., _, -).",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await updateProfile(
        { username: cleanUsername, name: name.trim() },
        session.accessToken
      );

      const newSession = {
        ...session,
        username: updated.username,
        name: updated.name,
      };

      setSession(newSession);

      // Persist to local storage
      try {
        await invoke("save_auth_session", {
          session: {
            access_token: newSession.accessToken,
            refresh_token: newSession.refreshToken,
            user_id: newSession.userId,
            email: newSession.email,
            username: newSession.username,
            name: newSession.name,
            subscription_status: newSession.subscription.status,
            subscription_plan: newSession.subscription.plan,
            expires_at: newSession.subscription.expiresAt,
            device_id: newSession.deviceId,
            last_sync_at: newSession.lastSyncAt,
          },
        });
      } catch {
        // Best effort
      }

      setProfileMessage({ type: "success", text: "Cập nhật thông tin tài khoản thành công!" });
    } catch (err: any) {
      setProfileMessage({
        type: "error",
        text: err?.message || "Không thể cập nhật thông tin. Vui lòng thử lại.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (!currentPassword) {
      setPwMessage({ type: "error", text: "Vui lòng nhập mật khẩu hiện tại." });
      return;
    }

    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Mật khẩu xác nhận không trùng khớp." });
      return;
    }

    setIsChangingPw(true);
    try {
      const res = await changePassword(
        { currentPassword, newPassword },
        session.accessToken
      );
      setPwMessage({ type: "success", text: res.message || "Đổi mật khẩu thành công!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwMessage({
        type: "error",
        text: err?.message || "Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.",
      });
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleLogoutOthers = async () => {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị khác không?")) {
      return;
    }
    setDeviceMessage(null);
    setIsLoggingOutOthers(true);
    try {
      const res = await logoutOtherDevices(session.accessToken);
      setDeviceMessage({
        type: "success",
        text: res.message || "Đã đăng xuất khỏi tất cả thiết bị khác thành công.",
      });
    } catch (err: any) {
      setDeviceMessage({
        type: "error",
        text: err?.message || "Không thể đăng xuất các thiết bị khác.",
      });
    } finally {
      setIsLoggingOutOthers(false);
    }
  };

  // Render modal directly in document.body using React Portal
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 select-none animate-fade-in">
      {/* Clickable dark backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      {/* Centered Popup Modal */}
      <div
        className="relative z-10 w-full max-w-lg bg-[#141722] border border-white/15 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh] overflow-hidden animate-scale-in text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Tài khoản & Bảo mật</h2>
              <p className="text-[11px] text-muted-foreground">Quản lý tên đăng nhập, mật khẩu và thiết bị</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10"
            title="Đóng (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-4 bg-black/20 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("profile");
              setProfileMessage(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User size={13} />
            Hồ sơ & Tài khoản
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setPwMessage(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "password"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound size={13} />
            Đổi mật khẩu
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("devices");
              setDeviceMessage(null);
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "devices"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Laptop size={13} />
            Thiết bị & Phiên
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Profile & Account */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-3.5 animate-fade-in">
              {/* Account summary banner */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shadow-inner">
                    {session.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{session.name}</span>
                      {session.subscription?.isPremium && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          <Crown size={9} /> VIP
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{session.email}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/10 text-foreground font-semibold">
                    {session.subscription?.status === "LIFETIME"
                      ? "Vĩnh viễn"
                      : session.subscription?.daysRemaining !== null
                      ? `Còn ${session.subscription.daysRemaining} ngày`
                      : session.subscription?.status}
                  </span>
                </div>
              </div>

              {/* Username Field */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
                  Tên tài khoản (Username)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                    placeholder="username"
                    minLength={3}
                    maxLength={30}
                    className="input-field pl-8 text-xs font-medium"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Dùng để đăng nhập thay thế email (3-30 ký tự, viết liền không dấu).
                </p>
              </div>

              {/* Full Name Field */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
                  Họ và tên hiển thị
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Họ và tên của bạn"
                  className="input-field text-xs font-medium"
                  required
                />
              </div>

              {/* Email (Readonly) */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
                  Email đăng ký
                </label>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-xs text-muted-foreground">
                  <span>{session.email}</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <CheckCircle2 size={11} /> Đã xác minh
                  </span>
                </div>
              </div>

              {profileMessage && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    profileMessage.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {profileMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn-base bg-white/5 hover:bg-white/10 text-foreground py-2 text-xs font-bold transition-colors cursor-pointer border border-white/10 rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 btn-base btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 rounded-xl"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Change Password */}
          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="space-y-3.5 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">Mật khẩu hiện tại</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pr-9 text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    minLength={6}
                    className="input-field pr-9 text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  minLength={6}
                  className="input-field text-xs"
                  required
                />
              </div>

              {pwMessage && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    pwMessage.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {pwMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{pwMessage.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn-base bg-white/5 hover:bg-white/10 text-foreground py-2 text-xs font-bold transition-colors cursor-pointer border border-white/10 rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isChangingPw}
                  className="flex-1 btn-base btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 rounded-xl"
                >
                  {isChangingPw ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang đổi...
                    </>
                  ) : (
                    <>
                      <KeyRound size={14} />
                      Cập nhật mật khẩu
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Devices & Sessions */}
          {activeTab === "devices" && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">Thiết bị hiện tại</label>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Laptop size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Máy tính này (Active)</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[240px]">
                        ID: {session.deviceId || "Không rõ"}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    Online
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Đăng xuất khỏi các thiết bị khác</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      Đăng xuất tài khoản của bạn khỏi tất cả các máy tính hoặc phiên đăng nhập khác ngay lập tức.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutOthers}
                  disabled={isLoggingOutOthers}
                  className="btn-base bg-destructive hover:bg-destructive/90 text-destructive-foreground w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-destructive/20 rounded-xl"
                >
                  {isLoggingOutOthers ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <LogOut size={14} />
                      Đăng xuất tất cả thiết bị khác
                    </>
                  )}
                </button>
              </div>

              {deviceMessage && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    deviceMessage.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {deviceMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{deviceMessage.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full btn-base bg-white/5 hover:bg-white/10 text-foreground py-2 text-xs font-bold transition-colors cursor-pointer border border-white/10 rounded-xl mt-2"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
