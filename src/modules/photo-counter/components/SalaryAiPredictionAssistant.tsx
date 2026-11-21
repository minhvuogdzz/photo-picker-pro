import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Settings,
  Bot,
  User,
  ArrowRight,
  TrendingUp,
  Target,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Flame,
  Clock,
  Briefcase,
  Crown,
  Loader2,
  Plug,
  X,
} from "lucide-react";
import type { SalaryCalculationResult, SalaryConfig } from "../types";
import {
  calculatePredictionMetrics,
  requestSalaryPrediction,
  type PredictionContext,
} from "../services/aiSalaryPredictionService";
import {
  aiSettingsService,
  getAvailableGeminiModels,
  DEFAULT_GEMINI_API_KEY,
} from "@/core/services/aiSettingsService";
import { useTranslation, getLocaleCode } from "@/core/lib/i18n";

interface SalaryAiPredictionAssistantProps {
  calc: SalaryCalculationResult;
  salaryConfig: SalaryConfig;
  monthName?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Lightweight and elegant Markdown formatter for AI responses
 */
function MarkdownView({ text }: { text: string }) {
  // Split into lines
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-xs leading-relaxed text-foreground select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty lines
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Horizontal line
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={idx} className="my-2 border-border/70" />;
        }

        // H1 / H2 / H3
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-xs font-bold text-foreground mt-2 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              {renderFormattedText(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-sm font-extrabold text-foreground mt-2.5 mb-1.5 border-b border-border/50 pb-1">
              {renderFormattedText(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-sm font-black text-foreground mt-3 mb-1.5">
              {renderFormattedText(trimmed.slice(2))}
            </h2>
          );
        }

        // Blockquotes
        if (trimmed.startsWith("> ")) {
          return (
            <div
              key={idx}
              className="border-l-2 border-primary/60 bg-muted/40 pl-2.5 py-1 my-1 italic text-muted-foreground rounded-r"
            >
              {renderFormattedText(trimmed.slice(2))}
            </div>
          );
        }

        // Bullet lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span className="flex-1">{renderFormattedText(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered lists (e.g. "1. ")
        const matchNum = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (matchNum) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-mono font-bold text-primary shrink-0">{matchNum[1]}.</span>
              <span className="flex-1">{renderFormattedText(matchNum[2])}</span>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-foreground/90">
            {renderFormattedText(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold **text** and inline `code`
 */
function renderFormattedText(text: string): React.ReactNode[] {
  // Regex to split by bold **...** or inline `...`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="font-mono px-1 py-0.2 rounded bg-muted text-primary text-[11px] font-semibold border border-border"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function SalaryAiPredictionAssistant({
  calc,
  salaryConfig,
  monthName,
}: SalaryAiPredictionAssistantProps) {
  const { tr, lang } = useTranslation();
  const locale = getLocaleCode(lang);

  // Target salary state (default: 18,000,000 or rounded up)
  const [targetSalary, setTargetSalary] = useState<number>(() => {
    return Math.max(18000000, Math.ceil((calc.totalSalary * 1.25) / 1000000) * 1000000);
  });

  // Current calendar day of month (default to today, or 22 if not in current month)
  const [currentDayOfMonth, setCurrentDayOfMonth] = useState<number>(() => {
    const today = new Date().getDate();
    return Math.min(today, salaryConfig.daysInMonth);
  });

  // Remaining days off to take before month ends
  const [remainingDaysOff, setRemainingDaysOff] = useState<number>(1);

  const initialGreeting = tr(
    `Xin chào! Tôi là **Cố Vấn Hiệu Suất Studio (AI Coach)**.\n\nTôi đã kết nối trực tiếp với bảng thống kê lương của bạn. Dù mục tiêu của bạn là **đạt chuẩn KPI** hay bứt phá thu nhập lên **${targetSalary.toLocaleString(
      locale
    )} đ**, hãy bấm nút **"AI Dự đoán"** hoặc chọn câu hỏi gợi ý bên dưới để chúng ta cùng lên kế hoạch tác chiến cụ thể cho từng ngày nhé!`,
    `Hello! I'm your **Studio Performance Coach (AI Coach)**.\n\nI'm directly connected to your payroll summary. Whether your goal is **hitting the monthly KPI** or reaching **${targetSalary.toLocaleString(
      locale
    )} VND**, click **"AI Predict"** or pick a quick suggestion below to build your daily action plan!`
  );

  // Chat message list
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "initial-coach-greeting",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    },
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(aiSettingsService.getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(aiSettingsService.getModel());
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Scroll to bottom reference
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Context builder
  const buildContext = (customQuestion?: string): PredictionContext => {
    return {
      monthName: monthName || tr("Tháng này", "This Month"),
      totalMonthDays: salaryConfig.daysInMonth,
      currentDayOfMonth,
      totalDaysOff: salaryConfig.daysOff,
      remainingDaysOff,
      actualWorkingDays: calc.actualWorkingDays,
      baseSalary: calc.baseSalary,
      dailyKpi: salaryConfig.dailyKpi,
      monthKpi: calc.monthKpi,
      actualPhotos: calc.actualPhotos,
      unitPriceKpi: salaryConfig.unitPriceKpi,
      vipSets: salaryConfig.vipSets,
      vipPrice: salaryConfig.vipPrice,
      vipBonus: calc.vipBonus,
      allowance: calc.allowance,
      deduction: calc.deduction,
      efficiencyBonus: calc.efficiencyBonus,
      currentTotalSalary: calc.totalSalary,
      targetSalary,
      type1Weight: salaryConfig.type1Weight,
      type2Weight: salaryConfig.type2Weight,
      userQuestion: customQuestion,
    };
  };

  // Pre-calculated mathematical metrics
  const predictionMetrics = calculatePredictionMetrics(buildContext());

  // Handle Send Question to AI
  const handleAskAi = async (questionText?: string) => {
    const textToSend = questionText || inputQuery;
    if (isLoading) return;

    // Create user message
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: textToSend.trim()
        ? textToSend
        : tr(
            `Dự đoán & Lên kế hoạch để tôi đạt mục tiêu ${targetSalary.toLocaleString(
              locale
            )} đ trong tháng này!`,
            `Predict & build an action plan to reach my ${targetSalary.toLocaleString(
              locale
            )} VND income goal this month!`
          ),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const ctx = buildContext(textToSend.trim() || undefined);
      const answer = await requestSalaryPrediction(ctx);

      const aiMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: "assistant",
        content: tr(
          `**Không thể lấy phản hồi từ Gemini AI**: ${
            err?.message || "Đã xảy ra lỗi không xác định."
          }\n\n*Gợi ý:* Hãy bấm vào biểu tượng bánh răng **Cài đặt AI** ở góc trên để kiểm tra hoặc cập nhật lại API Key nhé.`,
          `**Could not get response from Gemini AI**: ${
            err?.message || "An unknown error occurred."
          }\n\n*Tip:* Click the **AI Settings** gear icon at the top to check or update your API Key.`
        ),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick chips
  const quickSuggestions = [
    {
      label: tr(
        `Cần bao nhiêu ảnh/ngày để đạt ${targetSalary.toLocaleString(locale)} đ? (Kèm kịch bản VIP)`,
        `How many photos/day to hit ${targetSalary.toLocaleString(locale)} VND? (+ VIP scenarios)`
      ),
      query: tr(
        `Với mục tiêu thu nhập ${targetSalary.toLocaleString(
          locale
        )} đ, trong ${predictionMetrics.remainingWorkingDays} ngày làm việc còn lại, hãy tư vấn chi tiết: Nếu cày thuần ảnh thường thì cần bao nhiêu file/ngày? Và nếu tôi nhận thêm được các bộ VIP (ví dụ 3, 5 hoặc 10 bộ VIP) thì số file mỗi ngày sẽ giảm bớt được bao nhiêu? Nhớ tính cả việc tăng mốc thưởng hiệu suất nhé!`,
        `With an income target of ${targetSalary.toLocaleString(
          locale
        )} VND and ${predictionMetrics.remainingWorkingDays} working days left, please advise in detail: How many files/day do I need with standard photos alone? And if I add extra VIP sets (e.g., 3, 5, or 10 sets), how many fewer files/day will I need? Remember to factor in performance tier bonus jumps!`
      ),
    },
    {
      label: tr(
        `Kế hoạch cán mốc KPI để nhận lương cứng`,
        `Plan to reach Monthly KPI & unlock base salary`
      ),
      query: tr(
        `Hiện tôi đã làm ${calc.actualPhotos.toLocaleString(
          locale
        )} file, KPI tháng là ${calc.monthKpi.toLocaleString(
          locale
        )} file. Do chưa đủ KPI nên lương đang tính theo đơn giá 1 file (${salaryConfig.unitPriceKpi.toLocaleString(
          locale
        )} đ/file) và chưa được nhận lương cứng. Trong ${predictionMetrics.remainingWorkingDays} ngày làm việc còn lại, mỗi ngày tôi cần làm tối thiểu bao nhiêu file để kịp cán mốc KPI và lấy lại trọn vẹn lương cứng?`,
        `I've currently completed ${calc.actualPhotos.toLocaleString(
          locale
        )} files against a monthly KPI of ${calc.monthKpi.toLocaleString(
          locale
        )} files. Since KPI isn't met yet, my pay is calculated per-file (${salaryConfig.unitPriceKpi.toLocaleString(
          locale
        )} VND/file) with no base salary unlocked. With ${predictionMetrics.remainingWorkingDays} working days remaining, what is my minimum daily target to hit KPI and unlock full base salary?`
      ),
    },
    {
      label: tr(
        `Chiến thuật cày ảnh Loại 1 vs Loại 2 & VIP`,
        `Type 1 vs Type 2 & VIP strategy`
      ),
      query: tr(
        `Hãy tư vấn chiến thuật làm việc: nên ưu tiên đẩy ảnh Loại 1 hay Loại 2 và làm sao để nhận thêm thưởng bộ VIP để thu nhập nhanh chạm mốc nhất?`,
        `Please advise on work strategy: should I prioritize Type 1 or Type 2 photos, and how should I balance VIP sets to reach my income goal fastest?`
      ),
    },
    {
      label: tr(
        `Tiếp thêm động lực chiến đấu hôm nay!`,
        `Give me a motivation boost today!`
      ),
      query: tr(
        `Tôi đang hơi mệt và nản. Hãy cho tôi một bài truyền lửa mạnh mẽ để tôi tập trung cao độ mở Photoshop cày cuốc ngay bây giờ!`,
        `I'm feeling a bit tired and low on energy. Give me a strong pep talk so I can focus and crush today's editing goals!`
      ),
    },
  ];

  // Copy message text
  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Ignore
    }
  };

  // Test API Key Connection
  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage(null);
    try {
      // Save current input temporarily to test
      aiSettingsService.setApiKey(apiKeyInput.trim());
      aiSettingsService.setModel(selectedModel);

      const res = await aiSettingsService.generateContent(
        tr(
          "Xin chào! Trả lời ngắn gọn 1 câu để xác nhận kết nối API Gemini thành công.",
          "Hello! Reply in 1 short sentence to confirm the Gemini API connection is working."
        ),
        tr(
          "Bạn là hệ thống kiểm tra kết nối API.",
          "You are an API connection test responder."
        )
      );
      setTestStatus("success");
      setTestMessage(
        tr(
          `Kết nối thành công với ${res.model}! Sẵn sàng hoạt động.`,
          `Connected successfully to ${res.model}! Ready to use.`
        )
      );
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err?.message || tr("Lỗi kiểm tra API Key.", "API Key verification failed."));
    }
  };

  // Save Settings
  const handleSaveSettings = () => {
    aiSettingsService.setApiKey(apiKeyInput.trim());
    aiSettingsService.setModel(selectedModel);
    setShowSettings(false);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* 1. HEADER */}
      <div className="p-3.5 border-b border-border/80 bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0 shadow-2xs">
            <Bot size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground truncate">
                {tr("AI Dự Đoán & Lên Kế Hoạch Lương", "AI Salary Coach & Forecast")}
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-mono font-semibold shrink-0">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {tr("Phân tích số liệu thực tế & tính chỉ tiêu hành động theo ngày", "Analyze live metrics & compute daily actionable targets")}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
            title={tr("Cấu hình Gemini API Key & Model", "Configure Gemini API Key & Model")}
            aria-label={tr("Cấu hình Gemini API Key & Model", "Configure Gemini API Key & Model")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 2. REALTIME PREDICTION & TARGET CONFIG STRIP */}
      <div className="p-3 bg-muted/20 border-b border-border/70 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Target Salary Input */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {tr("Mục tiêu lương mong muốn", "Target Monthly Salary")}
            </label>
            <div className="relative">
              <input
                type="number"
                step="500000"
                value={targetSalary}
                onChange={(e) => setTargetSalary(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary pr-10"
              />
              <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-semibold">
                {tr("đ", "VND")}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {[15000000, 18000000, 20000000, 25000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetSalary(preset)}
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono transition-colors ${
                    targetSalary === preset
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {(preset / 1000000).toFixed(0)}{tr("Tr", "M")}
                </button>
              ))}
            </div>
          </div>

          {/* Current Date in Month */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {tr("Hôm nay là ngày", "Today is Day")}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max={salaryConfig.daysInMonth}
                value={currentDayOfMonth}
                onChange={(e) =>
                  setCurrentDayOfMonth(
                    Math.min(salaryConfig.daysInMonth, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">
                /{salaryConfig.daysInMonth}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {tr(
                `Còn ${predictionMetrics.remainingCalendarDays} ngày lịch đến hết tháng`,
                `${predictionMetrics.remainingCalendarDays} calendar days left this month`
              )}
            </p>
          </div>

          {/* Remaining Days Off */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {tr("Ngày nghỉ còn lại", "Remaining Days Off")}
            </label>
            <input
              type="number"
              min="0"
              max={predictionMetrics.remainingCalendarDays}
              value={remainingDaysOff}
              onChange={(e) =>
                setRemainingDaysOff(
                  Math.min(
                    predictionMetrics.remainingCalendarDays,
                    Math.max(0, Number(e.target.value) || 0)
                  )
                )
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-[10px] text-primary font-semibold mt-1">
              {tr(
                `Thực chiến còn ${predictionMetrics.remainingWorkingDays} ngày làm việc`,
                `${predictionMetrics.remainingWorkingDays} active working days left`
              )}
            </p>
          </div>
        </div>

        {/* Realtime KPI vs Target Breakdown Metrics Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/60">
          <div className="p-2 rounded-lg bg-card border border-border/70 space-y-0.5">
            <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
              <Briefcase size={10} />
              {tr("Công còn lại", "Remaining Shifts")}
            </span>
            <div className="text-xs font-mono font-extrabold text-foreground">
              {predictionMetrics.remainingWorkingDays} {tr("ngày", "days")}
            </div>
            <span className="text-[10px] text-muted-foreground block">
              {tr(`(Trừ ${remainingDaysOff} ngày nghỉ)`, `(Minus ${remainingDaysOff} days off)`)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-card border border-border/70 space-y-0.5">
            <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
              <Target size={10} />
              {predictionMetrics.isCurrentKpiAchieved
                ? tr("Chuẩn KPI tháng", "Monthly KPI Target")
                : tr("Để lấy Lương cứng", "To Unlock Base Salary")}
            </span>
            <div className="text-xs font-mono font-extrabold text-foreground">
              {predictionMetrics.isCurrentKpiAchieved
                ? tr("Đã có Lương cứng", "Base Salary Unlocked")
                : `${predictionMetrics.dailyPhotosForKpi} ${tr("file/ngày", "files/day")}`}
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {predictionMetrics.isCurrentKpiAchieved
                ? tr(
                    `Vượt +${(calc.actualPhotos - calc.monthKpi).toLocaleString(locale)} file`,
                    `Ahead +${(calc.actualPhotos - calc.monthKpi).toLocaleString(locale)} files`
                  )
                : tr(
                    `Thiếu ${predictionMetrics.kpiShortfall.toLocaleString(locale)} file (Hiện tính ${salaryConfig.unitPriceKpi.toLocaleString(locale)}đ/file)`,
                    `Short ${predictionMetrics.kpiShortfall.toLocaleString(locale)} files (Piece-rate ${salaryConfig.unitPriceKpi.toLocaleString(locale)}/file)`
                  )}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 space-y-0.5">
            <span className="text-[10px] text-primary font-bold block flex items-center gap-1">
              <TrendingUp size={10} />
              {tr("Để đạt", "To reach")} {targetSalary.toLocaleString(locale)} {tr("đ", "VND")}
            </span>
            <div className="text-xs font-mono font-extrabold text-primary">
              {predictionMetrics.dailyPhotosForTarget > 0
                ? `${predictionMetrics.dailyPhotosForTarget} ${tr("file/ngày", "files/day")}`
                : tr("Đã vượt mục tiêu", "Target Exceeded")}
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {predictionMetrics.salaryGap > 0
                ? tr(
                    `Tổng ${predictionMetrics.targetTotalPhotos.toLocaleString(locale)} file (gồm +${predictionMetrics.effBonusIncrease.toLocaleString(locale)}đ thưởng hiệu suất)`,
                    `Total ${predictionMetrics.targetTotalPhotos.toLocaleString(locale)} files (incl. +${predictionMetrics.effBonusIncrease.toLocaleString(locale)} performance bonus)`
                  )
                : tr("Đã đạt mức lương mong muốn", "Target salary reached")}
            </span>
          </div>
        </div>

        {/* Realtime VIP Sensitivity & Milestone Insights */}
        <div className="p-2 rounded-lg bg-card/90 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Crown size={12} className="text-amber-500" />
              {tr("Nếu có thêm VIP:", "With extra VIP sets:")}
            </span>
            {predictionMetrics.vipScenarios.map((s) => (
              <span
                key={s.extraVipSets}
                className="px-1.5 py-0.5 rounded bg-muted font-mono font-medium border border-border/60 text-foreground"
              >
                +{s.extraVipSets} VIP: <strong>{s.dailyPhotos}</strong> {tr("file/ngày", "files/day")}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 text-primary font-medium shrink-0">
            <TrendingUp size={11} className="text-primary" />
            <span>
              {tr("Mốc", "Tier")} {predictionMetrics.nextEffThreshold.toLocaleString(locale)} {tr("file: còn", "files:")}{" "}
              <strong>{predictionMetrics.photosToNextEffThreshold.toLocaleString(locale)} {tr("file", "files")}</strong> (+500k)
            </span>
          </div>
        </div>
      </div>

      {/* 3. CHATBOT STREAM */}
      <div className="h-64 sm:h-72 overflow-y-auto p-3.5 space-y-3 custom-scrollbar bg-background/50">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const displayContent = msg.id === "initial-coach-greeting" ? initialGreeting : msg.content;
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                  isUser
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted border border-border text-foreground"
                }`}
              >
                {isUser ? <User size={13} /> : <Bot size={13} className="text-primary" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`relative group max-w-[85%] rounded-xl p-3 shadow-2xs ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-none text-xs leading-relaxed"
                    : "bg-card border border-border/90 rounded-tl-none text-foreground"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap font-medium">{displayContent}</p>
                ) : (
                  <MarkdownView text={displayContent} />
                )}

                {/* Copy button for assistant responses */}
                {!isUser && (
                  <div className="mt-2 pt-1 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="opacity-70 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, displayContent)}
                      className="hover:text-foreground flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-muted"
                      title={tr("Sao chép câu trả lời", "Copy response")}
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check size={11} className="text-emerald-500" />
                          <span className="text-emerald-500">{tr("Đã sao chép", "Copied")}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>{tr("Sao chép", "Copy")}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded-full bg-muted border border-border text-primary flex items-center justify-center shrink-0">
              <Loader2 size={12} className="animate-spin" />
            </div>
            <div className="bg-card border border-border/80 rounded-xl rounded-tl-none p-3 shadow-2xs space-y-2 max-w-[85%]">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span>{tr("AI đang phân tích dữ liệu và lên lộ trình tác chiến...", "AI is analyzing your data and building your plan...")}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tr("Quét KPI:", "KPI:")} {calc.monthKpi} {tr("file", "files")} • {tr("Thực tế:", "Actual:")} {calc.actualPhotos} {tr("file", "files")} • {tr("Mục tiêu:", "Target:")}{" "}
                {targetSalary.toLocaleString(locale)} {tr("đ", "VND")}
              </p>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 4. QUICK SUGGESTION CHIPS */}
      <div className="px-3 py-2 bg-muted/10 border-t border-border/60 overflow-x-auto custom-scrollbar flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
          {tr("Gợi ý nhanh:", "Quick prompts:")}
        </span>
        {quickSuggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handleAskAi(item.query)}
            className="shrink-0 text-[11px] font-medium px-2 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-all hover:border-primary/50 disabled:opacity-50 cursor-pointer text-left"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 5. INPUT & ACTION BAR */}
      <div className="p-3 bg-card border-t border-border/80 flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAskAi();
            }
          }}
          disabled={isLoading}
          placeholder={tr("Nhập câu hỏi hoặc yêu cầu AI dự đoán lương...", "Ask a question or request an AI salary forecast...")}
          className="flex-1 px-3 py-2 text-xs rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/85 focus:outline-none focus:border-primary"
        />

        <button
          type="button"
          onClick={() => handleAskAi()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
          title={tr("Bấm để Gemini AI phân tích và dự đoán", "Click to run Gemini AI analysis & prediction")}
        >
          <Sparkles size={13} />
          <span>{tr("AI Dự đoán", "AI Predict")}</span>
        </button>
      </div>

      {/* 6. SETTINGS MODAL (GEMINI API KEY & MODEL) */}
      {showSettings && (
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-SalaryAiPredictionAssistant-1" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-4 space-y-4 text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                <h3 id="dlg-SalaryAiPredictionAssistant-1" className="text-sm font-bold text-foreground">
                  {tr("Cấu Hình Gemini AI Toàn Hệ Thống", "System-Wide Gemini AI Configuration")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                aria-label={tr("Đóng", "Close")}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Note about persistence */}
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-[11px] leading-relaxed">
              <strong>{tr("Lưu ý:", "Note:")}</strong>{" "}
              {tr("API Key được lưu tập trung trong bộ nhớ máy", "Your API Key is stored centrally in local storage")}{" "}
              (<code>localStorage</code>){" "}
              {tr(
                "và sẽ được dùng chung cho tính năng Dự đoán lương cũng như toàn bộ các dịch vụ AI tương lai của DH Studio Pro (Devhouse Software).",
                "and shared across Salary Coach and all future AI features in DH Studio Pro (Devhouse Software).",
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AQ.Ab8RN..."
                  className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:border-primary pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  title={showApiKey ? tr("Ẩn Key", "Hide Key") : tr("Hiện Key", "Show Key")}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span>{tr("Key mặc định của hệ thống đã được nạp sẵn.", "System default key is preloaded.")}</span>
                <button
                  type="button"
                  onClick={() => setApiKeyInput(DEFAULT_GEMINI_API_KEY)}
                  className="text-primary hover:underline font-semibold"
                >
                  {tr("Khôi phục Key gốc", "Restore Default Key")}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                {tr("Mô hình AI (Model)", "AI Model")}
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:border-primary"
              >
                {getAvailableGeminiModels(lang).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Test Connection Result */}
            {testStatus !== "idle" && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                  testStatus === "testing"
                    ? "bg-muted text-muted-foreground border-border"
                    : testStatus === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                {testStatus === "testing" && <RotateCcw size={14} className="animate-spin mt-0.5" />}
                {testStatus === "success" && <CheckCircle2 size={14} className="shrink-0 mt-0.5" />}
                {testStatus === "error" && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {testStatus === "testing"
                      ? tr("Đang gửi truy vấn thử nghiệm đến Google Gemini...", "Sending test request to Google Gemini...")
                      : testStatus === "success"
                      ? tr("Kết nối thành công!", "Connection successful!")
                      : tr("Lỗi kết nối!", "Connection failed!")}
                  </p>
                  {testMessage && <p className="text-[11px] opacity-90">{testMessage}</p>}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
                className="px-3 py-1.5 rounded-lg bg-muted hover:bg-accent border border-border text-foreground font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Plug size={12} />
                <span>{tr("Kiểm tra kết nối", "Test Connection")}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  {tr("Đóng", "Close")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
                >
                  {tr("Lưu cấu hình", "Save Settings")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
