/**
 * Account Expiration & Renewal Warning Service
 * 
 * Accurately analyzes all account types (Free Trial, Standard Active, VIP Premium, VIP 7-Day Grace Trial)
 * and determines if an expiration warning popup must be shown upon login.
 * 
 * Rule:
 * Any account type / feature trial with 3 days or fewer remaining (<= 3 days)
 * must trigger an expiration notice popup after each login into the app.
 */

import type { AuthSession } from "@/core/types/auth.ts";
import { checkPremiumFeatureAccess } from "./premiumFeaturePolicy.ts";

export type ExpirationCategory =
  | "TRIAL"          // Standard free trial of the app
  | "ACTIVE_BASIC"   // Standard paid license
  | "VIP_PREMIUM"    // Paid VIP Premium license
  | "VIP_TRIAL";     // 7-day trial of VIP features for active/lifetime accounts

export interface ExpiringNoticeInfo {
  readonly isExpiringSoon: boolean;
  readonly category: ExpirationCategory;
  readonly daysRemaining: number;
  readonly expiresAt?: string | null;
  readonly badgeLabel: string;
  readonly title: string;
  readonly headline: string;
  readonly message: string;
  readonly isVip: boolean;
  readonly suggestedMode: "activate" | "request";
  readonly affectedFeatures: readonly string[];
}

/** Threshold in days for triggering the warning popup */
export const EXPIRATION_WARNING_DAYS_THRESHOLD = 3;

/**
 * Calculates remaining days from now until target ISO date string.
 * Returns null if no date provided or invalid.
 */
export function calculateDaysRemaining(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!expiresAt) return null;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return null;

  const diffMs = expiryTime - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Checks whether an account is expiring within 3 days or less, across all account tiers.
 * Decoupled from DOM/UI for 100% testability.
 */
export function checkAccountExpiringNotice(
  session: AuthSession | null | undefined,
  overrideNow?: number
): ExpiringNoticeInfo | null {
  if (!session || !session.subscription) {
    return null;
  }

  const nowMs = typeof overrideNow === "number" ? overrideNow : Date.now();
  const sub = session.subscription;
  const status = sub.status;
  const isPremium = sub.isPremium === true;

  // 1. Excluded permanent statuses (EXPIRED, SUSPENDED, CANCELLED, INACTIVE are blocked by AuthGuard)
  if (["EXPIRED", "SUSPENDED", "CANCELLED", "INACTIVE"].includes(status)) {
    return null;
  }

  // Calculate days remaining on the main subscription (if expiresAt exists)
  const subDays = calculateDaysRemaining(sub.expiresAt, nowMs);

  // 2. CHECK TYPE A: Free Trial of the app (TRIAL)
  if (status === "TRIAL") {
    const days = subDays ?? sub.daysRemaining;
    if (typeof days === "number" && days <= EXPIRATION_WARNING_DAYS_THRESHOLD && days >= 0) {
      return {
        isExpiringSoon: true,
        category: "TRIAL",
        daysRemaining: days,
        expiresAt: sub.expiresAt,
        badgeLabel: "Gói Dùng Thử Miễn Phí (Trial)",
        title: "Tài Khoản Dùng Thử Sắp Hết Hạn",
        headline: "Thời gian dùng thử sắp kết thúc",
        message: `Tài khoản của bạn sắp hết thời gian dùng thử (còn ${
          days === 0 ? "hôm nay" : `${days} ngày`
        }). Vui lòng thanh toán hoặc gia hạn gói sử dụng để không làm gián đoạn trải nghiệm.`,
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          "Toàn bộ tính năng lọc ảnh và xuất file",
          "Xử lý danh sách khách hàng",
          "Quyền truy cập ứng dụng Photo Picker Pro",
        ],
      };
    }
  }

  // 3. CHECK TYPE B: Paid VIP Premium Subscription Expiring (VIP_PREMIUM)
  if (isPremium && status === "ACTIVE") {
    const days = subDays ?? sub.daysRemaining;
    if (typeof days === "number" && days <= EXPIRATION_WARNING_DAYS_THRESHOLD && days >= 0) {
      return {
        isExpiringSoon: true,
        category: "VIP_PREMIUM",
        daysRemaining: days,
        expiresAt: sub.expiresAt,
        badgeLabel: "Gói VIP Premium",
        title: "Gói VIP Premium Sắp Hết Hạn",
        headline: "Gói VIP Premium sắp hết hạn sử dụng",
        message: `Gói VIP Premium của bạn sắp hết hạn sử dụng (còn ${
          days === 0 ? "hôm nay" : `${days} ngày`
        }). Vui lòng thanh toán hoặc gia hạn gói sử dụng để không làm gián đoạn trải nghiệm và tiếp tục sử dụng không giới hạn các tính năng cao cấp.`,
        isVip: true,
        suggestedMode: "request",
        affectedFeatures: [
          "Truy xuất dữ liệu Google Sheet tự động",
          "Lọc ảnh nhiều khách cùng lúc (Multi-Client)",
          "Thống kê & Tính lương Studio Ops",
          "Tốc độ xử lý không giới hạn",
        ],
      };
    }
  }

  // 4. CHECK TYPE C: Standard Paid Subscription Expiring (ACTIVE_BASIC)
  if (!isPremium && status === "ACTIVE") {
    const days = subDays ?? sub.daysRemaining;
    if (typeof days === "number" && days <= EXPIRATION_WARNING_DAYS_THRESHOLD && days >= 0) {
      return {
        isExpiringSoon: true,
        category: "ACTIVE_BASIC",
        daysRemaining: days,
        expiresAt: sub.expiresAt,
        badgeLabel: "Bản Quyền Tiêu Chuẩn (Active)",
        title: "Bản Quyền Sắp Hết Hạn",
        headline: "Gói bản quyền sắp hết hạn sử dụng",
        message: `Tài khoản của bạn sắp hết hạn sử dụng (còn ${
          days === 0 ? "hôm nay" : `${days} ngày`
        }). Vui lòng thanh toán hoặc gia hạn gói sử dụng để không làm gián đoạn trải nghiệm lọc ảnh.`,
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          "Lọc ảnh và sao chép/di chuyển ảnh",
          "Đồng bộ cấu hình và xử lý ảnh hàng loạt",
        ],
      };
    }
  }

  // 5. CHECK TYPE D: VIP 7-Day Grace Trial Expiring (VIP_TRIAL)
  // For accounts with active or lifetime base license who are using the 7-day VIP grace trial
  if (!isPremium && (status === "ACTIVE" || status === "LIFETIME")) {
    const vipAccess = checkPremiumFeatureAccess(session, "sheet_extract", nowMs);
    if (
      vipAccess.isTrial &&
      vipAccess.daysRemaining <= EXPIRATION_WARNING_DAYS_THRESHOLD &&
      vipAccess.daysRemaining >= 0
    ) {
      return {
        isExpiringSoon: true,
        category: "VIP_TRIAL",
        daysRemaining: vipAccess.daysRemaining,
        expiresAt: vipAccess.trialEndsAt,
        badgeLabel: "Dùng Thử VIP Premium 7 Ngày",
        title: "Dùng Thử VIP Premium Sắp Hết Hạn",
        headline: "Thời gian dùng thử tính năng VIP sắp kết thúc",
        message: `Thời gian dùng thử tính năng VIP Premium của bạn sắp kết thúc (còn ${
          vipAccess.daysRemaining === 0 ? "hôm nay" : `${vipAccess.daysRemaining} ngày`
        }). Vui lòng nâng cấp hoặc gia hạn gói VIP Premium để không làm gián đoạn các tính năng cao cấp.`,
        isVip: true,
        suggestedMode: "request",
        affectedFeatures: [
          "Truy xuất dữ liệu Google Sheet tự động",
          "Lọc ảnh nhiều khách hàng cùng lúc",
          "Thống kê ảnh & Tính lương Studio",
        ],
      };
    }
  }

  return null;
}
