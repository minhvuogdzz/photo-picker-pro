import type { AuthSession } from "@/core/types/auth";
import { getCurrentLanguage, trText, type Language } from "../lib/i18n.ts";

export interface AppAccessResult {
  readonly hasAccess: boolean;
  readonly isTrial: boolean;
  readonly daysRemaining: number | null;
  readonly reason:
    | "TRIAL_ACTIVE"
    | "ENTITLEMENT_ACTIVE"
    | "EXPIRED"
    | "NOT_LICENSED"
    | "NO_SESSION";
}

/**
 * Checks if an authenticated session has access to a specific sub-app.
 * 
 * Rules:
 * 1. If no session -> no access.
 * 2. If status is SUSPENDED, CANCELLED, or INACTIVE -> no access.
 * 3. TRIAL POLICY: Any account in TRIAL (status === 'TRIAL' or daysRemaining > 0)
 *    has FULL UNRESTRICTED ACCESS to ALL apps and ALL features!
 * 4. PAID POLICY: When trial has ended, user must have an active (non-expired)
 *    entitlement for the target app (e.g. 'photo-picker', 'contact-the-sheet', 'resources', 'photo-counter')
 *    OR for 'ALL' (combo package).
 * 5. Backward compatibility for legacy ACTIVE/LIFETIME licenses without explicit entitlement array.
 * 6. ADMIN luôn có toàn quyền — nếu admin bị hết hạn/khoá thì không còn ai vào được
 *    trang quản trị để cấp key hay duyệt đơn, tức tự khoá chính mình ra khỏi hệ thống.
 */
export function checkAppAccess(
  session: AuthSession | null | undefined,
  targetApp: string
): AppAccessResult {
  if (!session) {
    return {
      hasAccess: false,
      isTrial: false,
      daysRemaining: 0,
      reason: "NO_SESSION",
    };
  }

  if (session.role === "ADMIN") {
    return {
      hasAccess: true,
      isTrial: false,
      daysRemaining: null,
      reason: "ENTITLEMENT_ACTIVE",
    };
  }

  const sub = session.subscription;
  const status = sub?.status;

  if (status === "SUSPENDED" || status === "CANCELLED" || status === "INACTIVE") {
    return {
      hasAccess: false,
      isTrial: false,
      daysRemaining: 0,
      reason: "NOT_LICENSED",
    };
  }

  const now = Date.now();
  const subExpiry = sub?.expiresAt ? new Date(sub.expiresAt).getTime() : 0;
  const entitlements = session.entitlements || sub?.entitlements || [];

  // 1. CHECK PAID ENTITLEMENTS — STACK/ACCUMULATE remaining days from ALL matching entitlements
  // e.g., photo-picker(30d) + ALL(368d) = 398 days total for photo-picker
  const paidMatching = entitlements.filter(
    (e) => !e.isTrial && (e.app === "ALL" || e.app === targetApp) && (!e.expiresAt || new Date(e.expiresAt).getTime() > now)
  );

  if (paidMatching.length > 0) {
    // Stack: sum remaining days from ALL applicable paid entitlements
    let totalRemainingMs = 0;
    for (const ent of paidMatching) {
      const entExpiry = ent.expiresAt ? new Date(ent.expiresAt).getTime() : subExpiry;
      if (entExpiry > now) {
        totalRemainingMs += (entExpiry - now);
      }
    }
    const totalDays = totalRemainingMs > 0 ? Math.ceil(totalRemainingMs / 86400000) : null;

    return {
      hasAccess: true,
      isTrial: false,
      daysRemaining: totalDays,
      reason: "ENTITLEMENT_ACTIVE",
    };
  }

  // 2. CHECK TRIAL ACCESS FOR THIS APP
  // Scenario A: Account is purely in TRIAL (status === 'TRIAL')
  if (status === "TRIAL") {
    if (subExpiry > now || !sub?.expiresAt) {
      const days = subExpiry > now ? Math.ceil((subExpiry - now) / 86400000) : (sub?.daysRemaining ?? 0);
      return {
        hasAccess: true,
        isTrial: true,
        daysRemaining: days,
        reason: "TRIAL_ACTIVE",
      };
    }
  }

  // Scenario B: Account has an unexpired trial entitlement specifically for targetApp or ALL
  const trialEntitlement = entitlements.find(
    (e) => e.isTrial && (e.app === "ALL" || e.app === targetApp) && (!e.expiresAt || new Date(e.expiresAt).getTime() > now)
  );

  if (trialEntitlement) {
    const trialExpiry = trialEntitlement.expiresAt ? new Date(trialEntitlement.expiresAt).getTime() : 0;
    if (trialExpiry > now || !trialEntitlement.expiresAt) {
      const days = trialExpiry > now ? Math.ceil((trialExpiry - now) / 86400000) : 0;
      return {
        hasAccess: true,
        isTrial: true,
        daysRemaining: days,
        reason: "TRIAL_ACTIVE",
      };
    }
  }

  // 3. Fallback for legacy active licenses without entitlements array
  if ((status === "ACTIVE" || status === "LIFETIME") && entitlements.length === 0) {
    if (subExpiry > now || !sub?.expiresAt) {
      const days = subExpiry > now ? Math.ceil((subExpiry - now) / 86400000) : null;
      return {
        hasAccess: true,
        isTrial: false,
        daysRemaining: days,
        reason: "ENTITLEMENT_ACTIVE",
      };
    }
  }

  // If no paid entitlement and no active trial entitlement -> App is LOCKED!
  return {
    hasAccess: false,
    isTrial: false,
    daysRemaining: 0,
    reason: "NOT_LICENSED",
  };
}

/**
 * Phiên làm việc có bị giới hạn thời lượng hay không.
 *
 * Quy tắc của chủ sản phẩm: tài khoản ĐÃ MUA (và admin) không bị timeout; tài khoản
 * DÙNG THỬ dùng số phút do admin cấu hình.
 *
 * Trước đây điều kiện là `status === "TRIAL" || daysRemaining > 0` nên MỌI tài khoản
 * còn hạn đều được coi là không giới hạn (daysRemaining là số ngày còn lại của gói,
 * không phân biệt trial/paid) — tính năng giới hạn phiên vì thế không bao giờ chạy.
 */
/**
 * Google Sheet / Drive features are part of both Contact The Sheet and Photo Picker
 * (sheet code extractor, filter status sync), so either licence allows the Google connection.
 */
export function hasGoogleFeatureAccess(session: AuthSession | null | undefined): boolean {
  return checkAppAccess(session, "contact-the-sheet").hasAccess || checkAppAccess(session, "photo-picker").hasAccess;
}

export function isUnlimitedSession(session: AuthSession | null | undefined): boolean {
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  if (session.sessionDurationMinutes === 0) return true;

  const sub = session.subscription;
  if (sub?.status === "ACTIVE" || sub?.status === "LIFETIME") return true;

  const now = Date.now();
  const entitlements = session.entitlements || sub?.entitlements || [];
  return entitlements.some(
    (e) => !e.isTrial && (!e.expiresAt || new Date(e.expiresAt).getTime() > now),
  );
}

export interface AppStatusDetail {
  readonly id: string;
  readonly name: string;
  readonly hasAccess: boolean;
  readonly isTrial: boolean;
  readonly daysRemaining: number | null;
  readonly expiresAt: string | null;
  readonly badgeText: string;
  readonly badgeVariant: "paid" | "trial" | "locked";
  readonly statusText: string;
}

export interface UserPlanInfo {
  readonly planType: "FULL_APP" | "PHOTO_PICKER_ONLY" | "OTHER_APP_ONLY" | "TRIAL" | "EXPIRED";
  readonly badgeLabel: string;
  readonly shortBadgeLabel: string;
  readonly planName: string;
  readonly description: string;
  readonly isFullApp: boolean;
  readonly isPhotoPickerOnly: boolean;
  readonly isTrial: boolean;
  readonly isLifetime: boolean;
  readonly isExpired: boolean;
  readonly daysRemaining: number | null;
  readonly expiresAt: string | null;
  readonly appsStatus: AppStatusDetail[];
}

export function getUserPlanInfo(session: AuthSession | null | undefined, lang: Language = getCurrentLanguage()): UserPlanInfo {
  const apps = [
    { id: "photo-picker", name: trText("Photo Picker Pro (Lọc ảnh)", "Photo Picker Pro", lang) },
    { id: "contact-the-sheet", name: trText("Contact The Sheet (Cấu hình Sheet)", "Contact The Sheet", lang) },
    { id: "resources", name: trText("Kho Tài Nguyên Creative", "Creative Resources Hub", lang) },
    { id: "photo-counter", name: trText("Photo Counter (Thống kê / Đếm ảnh)", "Photo Analytics & Counter", lang) },
  ];

  if (!session) {
    return {
      planType: "EXPIRED",
      badgeLabel: trText("Chưa đăng nhập", "Signed Out", lang),
      shortBadgeLabel: trText("Chưa đăng nhập", "Signed Out", lang),
      planName: trText("Chưa đăng nhập", "Signed Out", lang),
      description: trText("Vui lòng đăng nhập để sử dụng các tính năng.", "Please sign in to use features.", lang),
      isFullApp: false,
      isPhotoPickerOnly: false,
      isTrial: false,
      isLifetime: false,
      isExpired: true,
      daysRemaining: 0,
      expiresAt: null,
      appsStatus: apps.map((a) => ({
        id: a.id,
        name: a.name,
        hasAccess: false,
        isTrial: false,
        daysRemaining: 0,
        expiresAt: null,
        badgeText: trText("Chưa đăng nhập", "Signed Out", lang),
        badgeVariant: "locked",
        statusText: trText("Vui lòng đăng nhập", "Sign in required", lang),
      })),
    };
  }

  const sub = session.subscription;
  const status = sub?.status;
  const entitlements = session.entitlements || sub?.entitlements || [];
  const now = Date.now();

  const isAdmin = session.role === "ADMIN";

  const isSuspended =
    !isAdmin && (status === "SUSPENDED" || status === "CANCELLED" || status === "INACTIVE");
  if (isSuspended) {
    return {
      planType: "EXPIRED",
      badgeLabel: trText("Tài khoản bị khoá", "Account Locked", lang),
      shortBadgeLabel: trText("Đã khoá", "Locked", lang),
      planName: trText("Tài khoản tạm khoá", "Suspended Account", lang),
      description: trText("Tài khoản của bạn đang bị tạm ngưng hoặc vô hiệu hoá.", "Your account is suspended or deactivated.", lang),
      isFullApp: false,
      isPhotoPickerOnly: false,
      isTrial: false,
      isLifetime: false,
      isExpired: true,
      daysRemaining: 0,
      expiresAt: null,
      appsStatus: apps.map((a) => ({
        id: a.id,
        name: a.name,
        hasAccess: false,
        isTrial: false,
        daysRemaining: 0,
        expiresAt: null,
        badgeText: trText("Đã khoá", "Locked", lang),
        badgeVariant: "locked",
        statusText: trText("Tài khoản bị khoá", "Account locked", lang),
      })),
    };
  }

  const isLifetime = status === "LIFETIME";

  // Active paid entitlements
  const paidEntitlements = entitlements.filter(
    (e) => !e.isTrial && (!e.expiresAt || new Date(e.expiresAt).getTime() > now)
  );

  const hasPaidAll = isAdmin || isLifetime || paidEntitlements.some((e) => e.app === "ALL");
  const paidPicker = paidEntitlements.find((e) => e.app === "photo-picker");

  // Active trial entitlements
  const trialEntitlements = entitlements.filter(
    (e) => e.isTrial && (!e.expiresAt || new Date(e.expiresAt).getTime() > now)
  );
  const isPureTrial = status === "TRIAL" && (sub?.expiresAt ? new Date(sub.expiresAt).getTime() > now : true);
  const hasTrialActive = trialEntitlements.length > 0 || isPureTrial;

  // Compute appsStatus — with stacking logic
  const appsStatus: AppStatusDetail[] = apps.map((app) => {
    const access = checkAppAccess(session, app.id);
    let appExpiry: string | null = null;
    if (access.hasAccess) {
      if (!access.isTrial) {
        // Calculate stacked effective expiry from ALL applicable paid entitlements
        const matchingPaid = paidEntitlements.filter((e) => e.app === app.id || e.app === "ALL");
        if (matchingPaid.length > 0) {
          let totalRemainingMs = 0;
          for (const ent of matchingPaid) {
            const entExpiry = ent.expiresAt ? new Date(ent.expiresAt).getTime() : 0;
            if (entExpiry > now) {
              totalRemainingMs += (entExpiry - now);
            }
          }
          // Effective expiry = now + total stacked remaining time
          appExpiry = totalRemainingMs > 0 ? new Date(now + totalRemainingMs).toISOString() : null;
        } else {
          appExpiry = sub?.expiresAt || null;
        }
      } else {
        const ent = trialEntitlements.find((e) => e.app === app.id || e.app === "ALL");
        appExpiry = ent?.expiresAt || sub?.expiresAt || null;
      }
    }

    let badgeVariant: "paid" | "trial" | "locked" = "locked";
    let badgeText = trText("Chưa mở khoá", "Locked", lang);
    let statusText = trText("Chưa kích hoạt / Cần mua gói", "Not activated / Plan required", lang);

    if (access.hasAccess) {
      if (!access.isTrial) {
        badgeVariant = "paid";
        badgeText = isAdmin
          ? trText("Quản trị viên", "Admin", lang)
          : isLifetime
            ? trText("Bản quyền vĩnh viễn", "Lifetime License", lang)
            : trText(`Đã mua · ${access.daysRemaining ?? "∞"} ngày`, `Active · ${access.daysRemaining ?? "∞"}d`, lang);
        statusText = isAdmin
          ? trText("Toàn quyền quản trị", "Full administrator access", lang)
          : trText("Đã kích hoạt bản quyền", "License active", lang);
      } else {
        badgeVariant = "trial";
        badgeText = trText(`Dùng thử · ${access.daysRemaining ?? 0} ngày`, `Trial · ${access.daysRemaining ?? 0}d`, lang);
        statusText = trText("Đang dùng thử hệ sinh thái", "Ecosystem trial active", lang);
      }
    }

    return {
      id: app.id,
      name: app.name,
      hasAccess: access.hasAccess,
      isTrial: access.isTrial,
      daysRemaining: access.daysRemaining,
      expiresAt: appExpiry,
      badgeText,
      badgeVariant,
      statusText,
    };
  });

  // 1. Full App Paid
  if (hasPaidAll) {
    const paidAllEnt = paidEntitlements.find((e) => e.app === "ALL");
    const expiry = paidAllEnt?.expiresAt || sub?.expiresAt || null;
    const days = expiry ? Math.ceil((new Date(expiry).getTime() - now) / 86400000) : null;

    return {
      planType: "FULL_APP",
      badgeLabel: isAdmin
        ? trText("Quản trị viên · Toàn quyền", "Admin · Full Access", lang)
        : isLifetime
          ? trText("Full App · Vĩnh viễn", "Full App · Lifetime", lang)
          : trText(`Full App · ${days ?? "∞"} ngày`, `Full App · ${days ?? "∞"}d`, lang),
      shortBadgeLabel: isAdmin ? trText("Quản trị viên", "Admin", lang) : "Full App",
      planName: isAdmin
        ? trText("Tài khoản Quản trị (Admin)", "Administrator Account", lang)
        : trText("Gói Toàn Bộ Super App", "Full Super App Plan", lang),
      description: isAdmin
        ? trText("Tài khoản quản trị có toàn quyền truy cập mọi ứng dụng trong hệ sinh thái DH Studio Pro.", "Administrator account with full access across DH Studio Pro.", lang)
        : trText("Bạn đang sở hữu bản quyền toàn bộ hệ sinh thái ứng dụng DH Studio Pro.", "You hold a full license for the entire DH Studio Pro ecosystem.", lang),
      isFullApp: true,
      isPhotoPickerOnly: false,
      isTrial: false,
      isLifetime,
      isExpired: false,
      daysRemaining: days,
      expiresAt: expiry,
      appsStatus,
    };
  }

  // 2. Photo Picker Only Paid
  if (paidPicker) {
    const expiry = paidPicker.expiresAt || sub?.expiresAt || null;
    const days = expiry ? Math.ceil((new Date(expiry).getTime() - now) / 86400000) : null;

    return {
      planType: "PHOTO_PICKER_ONLY",
      badgeLabel: trText(`App Lọc Ảnh · ${days ?? "∞"} ngày`, `Photo Picker · ${days ?? "∞"}d`, lang),
      shortBadgeLabel: trText("App Lọc Ảnh", "Photo Picker", lang),
      planName: trText("Gói App Lọc Ảnh (Photo Picker)", "Photo Picker Pro Plan", lang),
      description: trText(
        "Bạn đang sử dụng bản quyền riêng cho App Lọc Ảnh. Các ứng dụng khác trong hệ sinh thái mở theo thời gian dùng thử (nếu còn).",
        "You have a standalone Photo Picker Pro license. Other ecosystem modules remain open while trial days remain.",
        lang
      ),
      isFullApp: false,
      isPhotoPickerOnly: true,
      isTrial: false,
      isLifetime: false,
      isExpired: false,
      daysRemaining: days,
      expiresAt: expiry,
      appsStatus,
    };
  }

  // 3. Other single app paid
  if (paidEntitlements.length > 0) {
    const primary = paidEntitlements[0];
    const expiry = primary.expiresAt || sub?.expiresAt || null;
    const days = expiry ? Math.ceil((new Date(expiry).getTime() - now) / 86400000) : null;
    const appLabel = apps.find((a) => a.id === primary.app)?.name || primary.app;

    return {
      planType: "OTHER_APP_ONLY",
      badgeLabel: trText(`Gói ${primary.app} · ${days ?? "∞"} ngày`, `${primary.app} · ${days ?? "∞"}d`, lang),
      shortBadgeLabel: primary.app,
      planName: trText(`Gói Bản Quyền: ${appLabel}`, `Module License: ${appLabel}`, lang),
      description: trText(`Bạn đang sử dụng bản quyền riêng cho ứng dụng ${appLabel}.`, `You have an active license for ${appLabel}.`, lang),
      isFullApp: false,
      isPhotoPickerOnly: false,
      isTrial: false,
      isLifetime: false,
      isExpired: false,
      daysRemaining: days,
      expiresAt: expiry,
      appsStatus,
    };
  }

  // 4. Trial active (Full App Trial)
  if (hasTrialActive) {
    const trialAllEnt = trialEntitlements.find((e) => e.app === "ALL") || trialEntitlements[0];
    const expiry = trialAllEnt?.expiresAt || sub?.expiresAt || null;
    const days = expiry ? Math.ceil((new Date(expiry).getTime() - now) / 86400000) : (sub?.daysRemaining ?? 0);

    return {
      planType: "TRIAL",
      badgeLabel: trText(`Dùng thử Full App · ${days} ngày`, `Full App Trial · ${days}d`, lang),
      shortBadgeLabel: trText("Dùng thử Full App", "Full App Trial", lang),
      planName: trText("Gói Dùng Thử Trải Nghiệm (Full App)", "Full App Free Trial", lang),
      description: trText(
        "Tài khoản đang trong thời gian trải nghiệm miễn phí toàn bộ hệ sinh thái DH Studio Pro.",
        "Your account is on a free full-access trial of DH Studio Pro.",
        lang
      ),
      isFullApp: true,
      isPhotoPickerOnly: false,
      isTrial: true,
      isLifetime: false,
      isExpired: false,
      daysRemaining: days,
      expiresAt: expiry,
      appsStatus,
    };
  }

  // 5. Expired
  return {
    planType: "EXPIRED",
    badgeLabel: trText("Đã hết hạn", "Expired", lang),
    shortBadgeLabel: trText("Hết hạn", "Expired", lang),
    planName: trText("Hết Hạn Bản Quyền", "License Expired", lang),
    description: trText(
      "Gói bản quyền hoặc thời gian dùng thử của bạn đã kết thúc. Vui lòng gia hạn để tiếp tục sử dụng.",
      "Your license or trial has expired. Please renew to continue using DH Studio Pro.",
      lang
    ),
    isFullApp: false,
    isPhotoPickerOnly: false,
    isTrial: false,
    isLifetime: false,
    isExpired: true,
    daysRemaining: 0,
    expiresAt: sub?.expiresAt || null,
    appsStatus,
  };
}
