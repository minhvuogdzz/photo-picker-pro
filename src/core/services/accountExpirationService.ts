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
import { trText } from "../lib/i18n.ts";

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
        badgeLabel: trText("Gói Dùng Thử Miễn Phí (Trial)", "Free Trial Plan"),
        title: trText("Tài Khoản Dùng Thử Sắp Hết Hạn", "Trial Account Expiring Soon"),
        headline: trText("Thời gian dùng thử sắp kết thúc", "Your trial period is ending soon"),
        message: trText(
          `Tài khoản của bạn sắp hết thời gian dùng thử (còn ${
            days === 0 ? "hôm nay" : `${days} ngày`
          }). Vui lòng thanh toán hoặc kích hoạt gói sử dụng để tiếp tục làm việc.`,
          `Your free trial is expiring soon (${
            days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} left`
          }). Please renew or activate a license key to keep working.`
        ),
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          trText("Toàn bộ tính năng lọc ảnh và xuất file", "All photo culling and export features"),
          trText("Xử lý danh sách khách hàng", "Customer queue processing"),
          trText("Quyền truy cập toàn bộ hệ sinh thái ứng dụng", "Access to all ecosystem apps"),
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
        badgeLabel: trText("Bản Quyền Đang Sử Dụng (Active)", "Active Subscription"),
        title: trText("Bản Quyền Sắp Hết Hạn", "License Expiring Soon"),
        headline: trText("Gói bản quyền sắp hết hạn sử dụng", "Your license plan is expiring soon"),
        message: trText(
          `Tài khoản của bạn sắp hết hạn sử dụng (còn ${
            days === 0 ? "hôm nay" : `${days} ngày`
          }). Vui lòng thanh toán hoặc gia hạn gói sử dụng để không làm gián đoạn trải nghiệm.`,
          `Your license is expiring soon (${
            days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} left`
          }). Please renew or extend your plan to avoid interruptions.`
        ),
        isVip: false,
        suggestedMode: "request",
        affectedFeatures: [
          trText("Các tính năng thuộc gói đã đăng ký", "Subscribed plan features"),
          trText("Đồng bộ cấu hình và xử lý công việc studio", "Workspace configuration & studio automation"),
        ],
      };
    }
  }

  return null;
}
