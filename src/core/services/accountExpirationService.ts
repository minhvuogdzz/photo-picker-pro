/**
 * Account Expiration & Renewal Warning Service
 * 
 * Accurately analyzes account status (Free Trial or Active Paid License)
 * and determines if an expiration warning popup must be shown upon login.
 * 
 * Rule:
 * Any account with 3 days or fewer remaining (<= 3 days)
 * must trigger an expiration notice popup after each login into the app.
 */

import type { AuthSession } from "@/core/types/auth.ts";

export type ExpirationCategory =
  | "TRIAL"          // Standard free trial of the app
  | "ACTIVE_BASIC";  // Standard paid license

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
 * Checks whether an account is expiring within 3 days or less.
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

  // 1. Excluded permanent statuses
  if (["EXPIRED", "SUSPENDED", "CANCELLED", "INACTIVE", "LIFETIME"].includes(status)) {
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
        }). Vui lòng thanh toán hoặc kích hoạt gói sử dụng để tiếp tục làm việc.`,
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          "Toàn bộ tính năng lọc ảnh và xuất file",
          "Xử lý danh sách khách hàng",
          "Quyền truy cập toàn bộ hệ sinh thái ứng dụng",
        ],
      };
    }
  }

  // 3. CHECK TYPE B: Active Paid Subscription Expiring (ACTIVE_BASIC)
  if (status === "ACTIVE") {
    const days = subDays ?? sub.daysRemaining;
    if (typeof days === "number" && days <= EXPIRATION_WARNING_DAYS_THRESHOLD && days >= 0) {
      return {
        isExpiringSoon: true,
        category: "ACTIVE_BASIC",
        daysRemaining: days,
        expiresAt: sub.expiresAt,
        badgeLabel: "Bản Quyền Đang Sử Dụng (Active)",
        title: "Bản Quyền Sắp Hết Hạn",
        headline: "Gói bản quyền sắp hết hạn sử dụng",
        message: `Tài khoản của bạn sắp hết hạn sử dụng (còn ${
          days === 0 ? "hôm nay" : `${days} ngày`
        }). Vui lòng thanh toán hoặc gia hạn gói sử dụng để không làm gián đoạn trải nghiệm.`,
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          "Các tính năng thuộc gói đã đăng ký",
          "Đồng bộ cấu hình và xử lý công việc studio",
        ],
      };
    }
  }

  return null;
}
