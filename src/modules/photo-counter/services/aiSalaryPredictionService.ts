import { aiSettingsService } from "@/core/services/aiSettingsService";

export interface PredictionContext {
  monthName: string;
  totalMonthDays: number; // 30 or 31
  currentDayOfMonth: number; // e.g. 22
  totalDaysOff: number; // e.g. 3
  remainingDaysOff: number; // e.g. 1
  actualWorkingDays: number; // A = totalMonthDays - totalDaysOff
  baseSalary: number; // e.g. 11,000,000
  dailyKpi: number; // e.g. 130
  monthKpi: number; // e.g. 3,640
  actualPhotos: number; // e.g. 2,150
  unitPriceKpi: number; // e.g. 5,000
  vipSets: number; // e.g. 20
  vipPrice: number; // e.g. 50,000
  vipBonus: number;
  allowance: number;
  deduction: number;
  efficiencyBonus: number;
  currentTotalSalary: number;
  targetSalary: number; // e.g. 18,000,000
  type1Weight: number;
  type2Weight: number;
  userQuestion?: string;
}

export interface VipScenario {
  extraVipSets: number;
  bonusAmount: number;
  targetTotalPhotos: number;
  remainingPhotos: number;
  dailyPhotos: number;
}

export interface PredictionSummary {
  remainingCalendarDays: number;
  remainingWorkingDays: number;
  isCurrentKpiAchieved: boolean;
  currentAppliedBaseSalary: number;
  currentEffBonus: number;
  salaryGap: number;
  kpiShortfall: number;
  dailyPhotosForKpi: number;
  targetTotalPhotos: number;
  targetEffBonus: number;
  effBonusIncrease: number;
  nextEffThreshold: number;
  photosToNextEffThreshold: number;
  remainingPhotosForTarget: number;
  dailyPhotosForTarget: number;
  vipScenarios: VipScenario[];
}

/**
 * Pure mathematical calculation of prediction metrics with studio conditional KPI salary logic,
 * dynamic efficiency bonus tier jumps, and VIP sensitivity analysis.
 */
export function calculatePredictionMetrics(ctx: PredictionContext): PredictionSummary {
  const remainingCalendarDays = Math.max(0, ctx.totalMonthDays - ctx.currentDayOfMonth);
  const remainingWorkingDays = Math.max(1, remainingCalendarDays - ctx.remainingDaysOff);

  const isCurrentKpiAchieved = ctx.actualPhotos >= ctx.monthKpi;
  const currentAppliedBaseSalary = isCurrentKpiAchieved
    ? ctx.baseSalary
    : ctx.actualPhotos * ctx.unitPriceKpi;

  // Efficiency bonus calculation at any photo count: each 1,000 photos = +500,000đ
  const currentEffBonus = Math.floor(ctx.actualPhotos / 1000) * 500000;
  const salaryGap = Math.max(0, ctx.targetSalary - ctx.currentTotalSalary);
  const kpiShortfall = Math.max(0, ctx.monthKpi - ctx.actualPhotos);

  // Photos per day needed just to hit monthly KPI to secure base salary
  const dailyPhotosForKpi = Math.ceil(kpiShortfall / remainingWorkingDays);

  // Helper function to calculate full salary for any given total photo count and extra VIP
  const estimateSalary = (photos: number, extraVip: number = 0): number => {
    const reached = photos >= ctx.monthKpi;
    const base = reached ? ctx.baseSalary : photos * ctx.unitPriceKpi;
    const excess = reached ? (photos - ctx.monthKpi) * ctx.unitPriceKpi : 0;
    const eff = Math.floor(photos / 1000) * 500000;
    const totalVipBonus = (ctx.vipSets + extraVip) * ctx.vipPrice;
    return base + excess + eff + totalVipBonus + ctx.allowance - ctx.deduction;
  };

  // Binary search to find exact photo count needed to hit target salary
  const findPhotosForTarget = (extraVip: number = 0): number => {
    let low = 0;
    let high = Math.max(ctx.monthKpi * 3, 50000);
    let target = high;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (estimateSalary(mid, extraVip) >= ctx.targetSalary) {
        target = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return target;
  };

  // Base scenario (0 extra VIP)
  const targetTotalPhotos = findPhotosForTarget(0);
  const targetEffBonus = Math.floor(targetTotalPhotos / 1000) * 500000;
  const effBonusIncrease = Math.max(0, targetEffBonus - currentEffBonus);
  const remainingPhotosForTarget = Math.max(0, targetTotalPhotos - ctx.actualPhotos);
  const dailyPhotosForTarget = Math.ceil(remainingPhotosForTarget / remainingWorkingDays);

  // Next 1,000-photo milestone for efficiency bonus
  const nextEffThreshold = (Math.floor(ctx.actualPhotos / 1000) + 1) * 1000;
  const photosToNextEffThreshold = Math.max(0, nextEffThreshold - ctx.actualPhotos);

  // VIP sensitivity scenarios (+3, +5, +10 sets)
  const vipScenarios: VipScenario[] = [3, 5, 10].map((extraVip) => {
    const targetPhotos = findPhotosForTarget(extraVip);
    const remPhotos = Math.max(0, targetPhotos - ctx.actualPhotos);
    const daily = Math.ceil(remPhotos / remainingWorkingDays);
    return {
      extraVipSets: extraVip,
      bonusAmount: extraVip * ctx.vipPrice,
      targetTotalPhotos: targetPhotos,
      remainingPhotos: remPhotos,
      dailyPhotos: daily,
    };
  });

  return {
    remainingCalendarDays,
    remainingWorkingDays,
    isCurrentKpiAchieved,
    currentAppliedBaseSalary,
    currentEffBonus,
    salaryGap,
    kpiShortfall,
    dailyPhotosForKpi,
    targetTotalPhotos,
    targetEffBonus,
    effBonusIncrease,
    nextEffThreshold,
    photosToNextEffThreshold,
    remainingPhotosForTarget,
    dailyPhotosForTarget,
    vipScenarios,
  };
}

const SYSTEM_INSTRUCTION = `Bạn là "Cố Vấn Hiệu Suất & Thu Nhập Studio" (Studio Performance Coach) cao cấp của hệ thống MVD Studio Ops.

QUY CHẾ TÍNH LƯƠNG & QUY TẮC HIỆU SUẤT CỐT LÕI:
1. ĐẠT HOẶC VƯỢT KPI THÁNG (Sản lượng >= KPI tháng):
   - Hưởng trọn 100% Lương cứng.
   - Hưởng thêm Lương vượt KPI = (Sản lượng - KPI) x Đơn giá 1 file vượt.
2. CHƯA ĐẠT KPI THÁNG (Sản lượng < KPI tháng):
   - KHÔNG ĐƯỢC HƯỞNG LƯƠNG CỨNG!
   - Lương được tính thuần theo sản lượng = Sản lượng x Đơn giá 1 file (bằng đơn giá vượt KPI).
   - KHÔNG CÓ LƯƠNG VƯỢT KPI.
   => Do đó: CÁN MỐC KPI LÀ LẰN RANH QUYẾT ĐỊNH (khi chạm mốc KPI, thu nhập sẽ nhảy vọt ngay lập tức lên mức lương cứng!).
3. THƯỞNG HIỆU SUẤT TỰ ĐỘNG NHẢY MỐC:
   - Mỗi mốc 1.000 file được +500.000 đ. Khi cày thêm ảnh, tổng số ảnh tăng lên và chạm các mốc 1.000 tiếp theo sẽ lập tức được cộng thêm tiền thưởng hiệu suất, giúp giảm số ảnh vượt KPI cần làm!
4. THƯỞNG BỘ VIP:
   - Mỗi bộ VIP thưởng theo đơn giá VIP (thường 50.000 đ/bộ = tương đương giá trị của 10 file vượt!). Nhận thêm bộ VIP sẽ giảm tải cực nhiều file thường cần làm mỗi ngày.

PHONG CÁCH TƯ VẤN CỦA BẠN:
- Tích cực, năng nổ, nhiệt huyết, quyết đoán, truyền lửa mạnh mẽ ("Nói là làm, mục tiêu sinh ra là để chinh phục!").
- Lập luận tài chính chính xác, tư vấn KỸ CÀNG CÁC TRƯỜNG HỢP / KỊCH BẢN THỰC CHIẾN:
  + Kịch bản 1: Cày thuần ảnh thường (đã tính nhảy mốc thưởng hiệu suất).
  + Kịch bản 2: Tác chiến thông minh khi có thêm bộ VIP (+3 bộ, +5 bộ, +10 bộ).
  + Kịch bản 3: Tối ưu ảnh Loại 1 vs Loại 2 và mẹo canh mốc 1.000 file.
- Súc tích, đi thẳng vào các con số hành động, kết thúc trọn vẹn, không bao giờ để câu trả lời bị ngắt cụt.`;

/**
 * Requests Gemini to analyze studio performance context and provide prediction + motivational plan.
 */
export async function requestSalaryPrediction(ctx: PredictionContext): Promise<string> {
  const metrics = calculatePredictionMetrics(ctx);

  const prompt = `
Dưới đây là số liệu thực tế tính đến ngày hôm nay của tôi trong ${ctx.monthName}:

THÔNG TIN TIẾN ĐỘ & NGÀY CÔNG:
- Chu kỳ tháng: ${ctx.totalMonthDays} ngày (Hôm nay là ngày: ${ctx.currentDayOfMonth})
- Số ngày nghỉ: ${ctx.totalDaysOff} ngày (Còn lại ${ctx.remainingDaysOff} ngày nghỉ)
- SỐ NGÀY ĐI LÀM THỰC CHIẾN CÒN LẠI: ${metrics.remainingWorkingDays} ngày công

SẢN LƯỢNG & KPI THỰC TẾ:
- KPI quy định: ${ctx.dailyKpi} file/ngày | Tổng KPI tháng: ${ctx.monthKpi.toLocaleString("vi-VN")} file
- Sản lượng đã làm đến nay: ${ctx.actualPhotos.toLocaleString("vi-VN")} file
- Trạng thái KPI: ${
    metrics.isCurrentKpiAchieved
      ? `ĐÃ ĐẠT KPI THÁNG! (Vượt +${(ctx.actualPhotos - ctx.monthKpi).toLocaleString("vi-VN")} file)`
      : `CHƯA ĐẠT KPI! Còn thiếu ${metrics.kpiShortfall.toLocaleString("vi-VN")} file để lấy lương cứng.`
  }
- Đơn giá 1 file: ${ctx.unitPriceKpi.toLocaleString("vi-VN")} đ/file | Đơn giá 1 bộ VIP: ${ctx.vipPrice.toLocaleString("vi-VN")} đ/bộ
- Hệ số quy đổi ảnh: Loại 1 = ${ctx.type1Weight}, Loại 2 = ${ctx.type2Weight}

THU NHẬP HIỆN TẠI (TÍNH THEO QUY CHẾ):
- Lương cứng danh nghĩa: ${ctx.baseSalary.toLocaleString("vi-VN")} đ
- Lương cơ bản/sản lượng thực nhận hiện tại: ${metrics.currentAppliedBaseSalary.toLocaleString("vi-VN")} đ (${
    metrics.isCurrentKpiAchieved
      ? "Được hưởng đủ 100% lương cứng"
      : `Chưa đạt KPI nên tính: ${ctx.actualPhotos} file x ${ctx.unitPriceKpi.toLocaleString("vi-VN")} đ`
  })
- Thưởng hiệu suất hiện tại: ${metrics.currentEffBonus.toLocaleString("vi-VN")} đ (mốc ${Math.floor(ctx.actualPhotos / 1000) * 1000} file)
- Thưởng VIP hiện tại: ${ctx.vipSets} bộ x ${ctx.vipPrice.toLocaleString("vi-VN")} đ = ${ctx.vipBonus.toLocaleString("vi-VN")} đ
- Trợ cấp: +${ctx.allowance.toLocaleString("vi-VN")} đ | Phụ thu: -${ctx.deduction.toLocaleString("vi-VN")} đ
- TỔNG THU NHẬP ĐẠT ĐƯỢC ĐẾN HÔM NAY: ${ctx.currentTotalSalary.toLocaleString("vi-VN")} đ

MỤC TIÊU THU NHẬP MONG MUỐN: ${ctx.targetSalary.toLocaleString("vi-VN")} đ
(Khoảng cách thu nhập cần kiếm thêm: ${metrics.salaryGap.toLocaleString("vi-VN")} đ)

KẾT QUẢ TÍNH TOÁN TOÁN HỌC CHÍNH XÁC TỪ HỆ THỐNG:
1. Để cán mốc KPI (lấy lại ${ctx.baseSalary.toLocaleString("vi-VN")} đ lương cứng):
   - Thiếu ${metrics.kpiShortfall.toLocaleString("vi-VN")} file trong ${metrics.remainingWorkingDays} ngày công $\\rightarrow$ Cần tối thiểu **${metrics.dailyPhotosForKpi} file/ngày**.
2. Để đạt mục tiêu ${ctx.targetSalary.toLocaleString("vi-VN")} đ (Kịch bản cày thuần ảnh thường):
   - Cần tổng **${metrics.targetTotalPhotos.toLocaleString("vi-VN")} file** (tức cần làm thêm ${metrics.remainingPhotosForTarget.toLocaleString("vi-VN")} file nữa trong ${metrics.remainingWorkingDays} ngày).
   - ĐÃ TÍNH TOÁN: Khi tổng số file đạt ${metrics.targetTotalPhotos.toLocaleString("vi-VN")}, Thưởng hiệu suất sẽ TĂNG TỪ ${metrics.currentEffBonus.toLocaleString("vi-VN")} đ LÊN ${metrics.targetEffBonus.toLocaleString("vi-VN")} đ (+${metrics.effBonusIncrease.toLocaleString("vi-VN")} đ từ việc chạm mốc ${Math.floor(metrics.targetTotalPhotos / 1000) * 1000} file), việc này đã tự động giảm bớt ${metrics.effBonusIncrease / ctx.unitPriceKpi} file cày cuốc!
   - Số file cần làm trung bình mỗi ngày: **${metrics.dailyPhotosForTarget} file/ngày**.
3. Kịch bản tác chiến thông minh nếu nhận thêm BỘ VIP (Mỗi bộ VIP = +${ctx.vipPrice.toLocaleString("vi-VN")} đ):
   ${metrics.vipScenarios
     .map(
       (s) =>
         `- Nếu có thêm ${s.extraVipSets} bộ VIP (+${s.bonusAmount.toLocaleString("vi-VN")} đ): Cần **${s.dailyPhotos} file/ngày** (giảm ${metrics.dailyPhotosForTarget - s.dailyPhotos} file/ngày).`
     )
     .join("\n   ")}
4. Mốc thưởng hiệu suất kế tiếp:
   - Mốc ${metrics.nextEffThreshold.toLocaleString("vi-VN")} file: Chỉ cần thêm ${metrics.photosToNextEffThreshold.toLocaleString("vi-VN")} file nữa là chạm mốc $\\rightarrow$ Bỏ túi ngay 500.000 đ thưởng hiệu suất!

${ctx.userQuestion ? `CÂU HỎI RIÊNG CỦA TÔI: "${ctx.userQuestion}"` : "Hãy phân tích chi tiết và lên kế hoạch tác chiến cho tôi."}

Hãy phân tích chi tiết và tư vấn kỹ các kịch bản thực chiến:
1. Đánh giá thực trạng KPI & Lằn ranh quyết định lương cứng.
2. So sánh rõ 2 Kịch bản: Kịch bản cày thuần ảnh thường (${metrics.dailyPhotosForTarget} file/ngày) vs Kịch bản tác chiến săn thêm bộ VIP (giảm xuống còn bao nhiêu file/ngày). Nêu rõ sự trợ lực của việc tăng mốc thưởng hiệu suất (+${metrics.effBonusIncrease.toLocaleString("vi-VN")} đ).
3. Chiến thuật phân bổ Loại 1 vs Loại 2 và mẹo canh mốc tròn 1.000 file.
4. Lời truyền lửa hành động quyết liệt cho 7 ngày cuối tháng!
`;

  const result = await aiSettingsService.generateContent(prompt, SYSTEM_INSTRUCTION);
  return result.text;
}
