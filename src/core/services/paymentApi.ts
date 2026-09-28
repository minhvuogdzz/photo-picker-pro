import { apiRequest } from "./apiClient";

export interface PricingPackage {
  readonly id: string;
  readonly targetApp: string;
  readonly name: string;
  readonly durationDays: number;
  readonly price: number;
  readonly originalPrice?: number;
  readonly badge?: string;
  readonly isPopular?: boolean;
}

export interface BankInfo {
  readonly bankBin: string;
  readonly bankAccountNo: string;
  readonly bankAccountName: string;
}

export interface CreateOrderRequest {
  readonly targetApp: string;
  readonly packageName: string;
  readonly amount: number;
  readonly durationDays: number;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly buyerPhone: string;
}

export interface CreateOrderResponse {
  readonly orderId: string;
  readonly orderCode: string;
  readonly amount: number;
  readonly packageName: string;
  readonly targetApp: string;
  readonly durationDays: number;
  readonly buyerName?: string;
  readonly buyerEmail?: string;
  readonly qrUrl: string;
  readonly bankInfo: {
    readonly bankBin: string;
    readonly bankAccountNo: string;
    readonly bankAccountName: string;
    readonly orderCode: string;
    readonly amount: number;
  };
}

export interface OrderStatusResponse {
  readonly id: string;
  readonly orderCode: string;
  readonly status: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED";
  readonly amount: number;
  readonly paidAmount?: number;
  readonly generatedKey?: string;
  readonly targetApp: string;
  readonly durationDays: number;
  readonly packageName: string;
  readonly paidAt?: string;
}

/** Lấy danh sách gói cước từ DB */
export async function getPricingPackages(): Promise<PricingPackage[]> {
  try {
    const res = await apiRequest<any>("/payment/packages");
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  } catch (err) {
    console.error("Failed to load packages from API, using fallback defaults:", err);
    return [
      { id: "super_1m", targetApp: "ALL", name: "Gói Super App 1 Tháng", durationDays: 30, price: 99000, originalPrice: 129000 },
      { id: "super_3m", targetApp: "ALL", name: "Gói Super App 3 Tháng", durationDays: 90, price: 149000, originalPrice: 249000, badge: "Phổ biến", isPopular: true },
      { id: "super_6m", targetApp: "ALL", name: "Gói Super App 6 Tháng", durationDays: 180, price: 249000, originalPrice: 399000 },
      { id: "super_12m", targetApp: "ALL", name: "Gói Super App 12 Tháng", durationDays: 365, price: 499000, originalPrice: 899000, badge: "Tiết kiệm nhất" },
      { id: "picker_1m", targetApp: "photo-picker", name: "Gói Photo Picker Pro 1 Tháng", durationDays: 30, price: 49000, originalPrice: 79000 },
      { id: "picker_3m", targetApp: "photo-picker", name: "Gói Photo Picker Pro 3 Tháng", durationDays: 90, price: 129000, originalPrice: 199000 },
      { id: "picker_6m", targetApp: "photo-picker", name: "Gói Photo Picker Pro 6 Tháng", durationDays: 180, price: 229000, originalPrice: 329000 },
      { id: "picker_12m", targetApp: "photo-picker", name: "Gói Photo Picker Pro 12 Tháng", durationDays: 365, price: 329000, originalPrice: 529000, badge: "Ưu đãi năm" },
    ];
  }
}

/** Lấy thông tin tài khoản ngân hàng */
export async function getBankConfig(): Promise<BankInfo> {
  const res = await apiRequest<any>("/payment/bank-info");
  return res?.bankBin ? res : (res?.data || res);
}

/** Tạo đơn hàng thanh toán VietQR */
export async function createPaymentOrder(
  data: CreateOrderRequest,
  token?: string,
): Promise<CreateOrderResponse> {
  const res = await apiRequest<any>("/payment/create-order", {
    method: "POST",
    body: data,
    accessToken: token,
  });
  return res?.orderCode ? res : (res?.data || res);
}

/** Kiểm tra trạng thái đơn hàng (polling) */
export async function checkOrderStatus(
  orderCode: string,
  token?: string,
): Promise<OrderStatusResponse> {
  const res = await apiRequest<any>(
    `/payment/order/${orderCode}/status`,
    {
      accessToken: token,
    },
  );
  return res?.status ? res : (res?.data || res);
}
