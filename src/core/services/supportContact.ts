/**
 * Số Zalo hỗ trợ — do admin cấu hình trong trang quản trị, KHÔNG hardcode.
 *
 * Trước đây số này nằm cứng trong 3 file và còn lệch nhau (0981989098 ở popup gia hạn,
 * 0869528304 ở màn hình hệ thống), nên khách bấm vào là gọi nhầm người lạ. Nếu admin
 * chưa cấu hình thì các màn hình sẽ ẩn hẳn phần liên hệ — thà không hiện còn hơn hiện
 * một số điện thoại sai.
 */

import { useEffect, useState } from "react";
import { apiRequest } from "@/core/services/apiClient";

const CACHE_KEY = "mvd_support_zalo";

export interface SupportZalo {
  /** Chỉ chữ số, dạng nội địa (0…) — dùng cho link zalo.me */
  readonly phone: string;
  /** Dạng hiển thị, ví dụ 0869.528.304 */
  readonly display: string;
  readonly href: string;
}

/** Nhận mọi kiểu admin gõ (+84, khoảng trắng, dấu chấm) và chuẩn hoá về 0… */
export function toSupportZalo(raw: string | null | undefined): SupportZalo | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 9) return null;

  const local = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  const display =
    local.length === 10
      ? `${local.slice(0, 4)}.${local.slice(4, 7)}.${local.slice(7)}`
      : local;

  return { phone: local, display, href: `https://zalo.me/${local}` };
}

function readCache(): SupportZalo | null {
  try {
    return toSupportZalo(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

/**
 * Trả về thông tin Zalo hỗ trợ, hoặc null nếu admin chưa cấu hình.
 * Hiện ngay từ cache để không bị nhấp nháy, rồi đồng bộ lại với server.
 */
export function useSupportZalo(): SupportZalo | null {
  const [contact, setContact] = useState<SupportZalo | null>(readCache);

  useEffect(() => {
    apiRequest<{ supportZaloPhone?: string }>("/config/public")
      .then((data) => {
        const next = toSupportZalo(data?.supportZaloPhone);
        setContact(next);
        try {
          if (next) localStorage.setItem(CACHE_KEY, next.phone);
          else localStorage.removeItem(CACHE_KEY);
        } catch {
          // Không có localStorage cũng không sao
        }
      })
      .catch(() => {
        // Offline: giữ nguyên giá trị cache
      });
  }, []);

  return contact;
}
