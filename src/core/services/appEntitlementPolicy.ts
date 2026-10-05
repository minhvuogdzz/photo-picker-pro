import type { AuthSession } from "@/core/types/auth";

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

export function getUserPlanInfo(session: AuthSession | null | undefined): UserPlanInfo {
  const apps = [
    { id: "photo-picker", name: "Photo Picker Pro (Lọc ảnh)" },
    { id: "contact-the-sheet", name: "Contact The Sheet (Cấu hình Sheet)" },
    { id: "resources", name: "Kho Tài Nguyên Creative" },
    { id: "photo-counter", name: "Photo Counter (Thống kê / Đếm ảnh)" },
  ];

  if (!session) {
    return {
      planType: "EXPIRED",
      badgeLabel: "Chưa đăng nhập",
      shortBadgeLabel: "Chưa đăng nhập",
      planName: "Chưa đăng nhập",
      description: "Vui lòng đăng nhập để sử dụng các tính năng.",
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
        badgeText: "Chưa đăng nhập",
        badgeVariant: "locked",
        statusText: "Vui lòng đăng nhập",
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
      badgeLabel: "Tài khoản bị khoá",
      shortBadgeLabel: "Đã khoá",
      planName: "Tài khoản tạm khoá",
      description: "Tài khoản của bạn đang bị tạm ngưng hoặc vô hiệu hoá.",
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
        badgeText: "Đã khoá",
        badgeVariant: "locked",
        statusText: "Tài khoản bị khoá",
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
    let badgeText = "Chưa mở khoá";
    let statusText = "Chưa kích hoạt / Cần mua gói";

    if (access.hasAccess) {
      if (!access.isTrial) {
        badgeVariant = "paid";
        badgeText = isAdmin
          ? "Quản trị viên"
          : isLifetime
            ? "Bản quyền vĩnh viễn"
            : `Đã mua · ${access.daysRemaining ?? "∞"} ngày`;
        statusText = isAdmin ? "Toàn quyền quản trị" : "Đã kích hoạt bản quyền";
      } else {
        badgeVariant = "trial";
        badgeText = `Dùng thử · ${access.daysRemaining ?? 0} ngày`;
        statusText = "Đang dùng thử hệ sinh thái";
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
        ? "Quản trị viên · Toàn quyền"
        : isLifetime
          ? "Full App · Vĩnh viễn"
          : `Full App · ${days ?? "∞"} ngày`,
      shortBadgeLabel: isAdmin ? "Quản trị viên" : "Full App",
      planName: isAdmin ? "Tài khoản Quản trị (Admin)" : "Gói Toàn Bộ Super App",
      description: isAdmin
        ? "Tài khoản quản trị có toàn quyền truy cập mọi ứng dụng trong hệ sinh thái DH Studio Pro."
        : "Bạn đang sở hữu bản quyền toàn bộ hệ sinh thái ứng dụng DH Studio Pro.",
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
      badgeLabel: `App Lọc Ảnh · ${days ?? "∞"} ngày`,
      shortBadgeLabel: "App Lọc Ảnh",
      planName: "Gói App Lọc Ảnh (Photo Picker)",
      description: "Bạn đang sử dụng bản quyền riêng cho App Lọc Ảnh. Các ứng dụng khác trong hệ sinh thái mở theo thời gian dùng thử (nếu còn).",
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
      badgeLabel: `Gói ${primary.app} · ${days ?? "∞"} ngày`,
      shortBadgeLabel: primary.app,
      planName: `Gói Bản Quyền: ${appLabel}`,
      description: `Bạn đang sử dụng bản quyền riêng cho ứng dụng ${appLabel}.`,
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
      badgeLabel: `Dùng thử Full App · ${days} ngày`,
      shortBadgeLabel: "Dùng thử Full App",
      planName: "Gói Dùng Thử Trải Nghiệm (Full App)",
      description: "Tài khoản đang trong thời gian trải nghiệm miễn phí toàn bộ hệ sinh thái DH Studio Pro.",
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
    badgeLabel: "Đã hết hạn",
    shortBadgeLabel: "Hết hạn",
    planName: "Hết Hạn Bản Quyền",
    description: "Gói bản quyền hoặc thời gian dùng thử của bạn đã kết thúc. Vui lòng gia hạn để tiếp tục sử dụng.",
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
