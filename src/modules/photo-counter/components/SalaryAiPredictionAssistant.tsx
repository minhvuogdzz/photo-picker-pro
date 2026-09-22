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
  Zap,
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
} from "lucide-react";
import type { SalaryCalculationResult, SalaryConfig } from "../types";
import {
  calculatePredictionMetrics,
  requestSalaryPrediction,
  type PredictionContext,
} from "../services/aiSalaryPredictionService";
import {
  aiSettingsService,
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_GEMINI_API_KEY,
} from "@/core/services/aiSettingsService";

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

  // Chat message list
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "initial-coach-greeting",
      role: "assistant",
      content: `Xin chào! Tôi là **Cố Vấn Hiệu Suất Studio (AI Coach)**. ⚡\n\nTôi đã kết nối trực tiếp với bảng thống kê lương của bạn. Dù mục tiêu của bạn là **đạt chuẩn KPI** hay bứt phá thu nhập lên **${targetSalary.toLocaleString(
        "vi-VN"
      )} đ**, hãy bấm nút **"AI Dự đoán"** hoặc chọn câu hỏi gợi ý bên dưới để chúng ta cùng lên kế hoạch tác chiến cụ thể cho từng ngày nhé! 🔥`,
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
      monthName: monthName || "Tháng này",
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
        : `Dự đoán & Lên kế hoạch để tôi đạt mục tiêu ${targetSalary.toLocaleString(
            "vi-VN"
          )} đ trong tháng này!`,
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
        content: `⚠️ **Không thể lấy phản hồi từ Gemini AI**: ${
          err?.message || "Đã xảy ra lỗi không xác định."
        }\n\n*Gợi ý:* Hãy bấm vào biểu tượng bánh răng **Cài đặt AI** ở góc trên để kiểm tra hoặc cập nhật lại API Key nhé.`,
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
      label: `Cần bao nhiêu ảnh/ngày để đạt ${targetSalary.toLocaleString("vi-VN")} đ? (Kèm kịch bản VIP)`,
      query: `Với mục tiêu thu nhập ${targetSalary.toLocaleString(
        "vi-VN"
      )} đ, trong ${predictionMetrics.remainingWorkingDays} ngày làm việc còn lại, hãy tư vấn chi tiết: Nếu cày thuần ảnh thường thì cần bao nhiêu file/ngày? Và nếu tôi nhận thêm được các bộ VIP (ví dụ 3, 5 hoặc 10 bộ VIP) thì số file mỗi ngày sẽ giảm bớt được bao nhiêu? Nhớ tính cả việc tăng mốc thưởng hiệu suất nhé!`,
    },
    {
      label: `Kế hoạch cán mốc KPI để nhận lương cứng`,
      query: `Hiện tôi đã làm ${calc.actualPhotos.toLocaleString(
        "vi-VN"
      )} file, KPI tháng là ${calc.monthKpi.toLocaleString(
        "vi-VN"
      )} file. Do chưa đủ KPI nên lương đang tính theo đơn giá 1 file (${salaryConfig.unitPriceKpi.toLocaleString(
        "vi-VN"
      )} đ/file) và chưa được nhận lương cứng. Trong ${predictionMetrics.remainingWorkingDays} ngày làm việc còn lại, mỗi ngày tôi cần làm tối thiểu bao nhiêu file để kịp cán mốc KPI và lấy lại trọn vẹn lương cứng?`,
    },
    {
      label: `Chiến thuật cày ảnh Loại 1 vs Loại 2 & VIP`,
      query: `Hãy tư vấn chiến thuật làm việc: nên ưu tiên đẩy ảnh Loại 1 hay Loại 2 và làm sao để nhận thêm thưởng bộ VIP để thu nhập nhanh chạm mốc nhất?`,
    },
    {
      label: `🔥 Tiếp thêm động lực chiến đấu hôm nay!`,
      query: `Tôi đang hơi mệt và nản. Hãy cho tôi một bài truyền lửa mạnh mẽ để tôi tập trung cao độ mở Photoshop cày cuốc ngay bây giờ!`,
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
        "Xin chào! Trả lời ngắn gọn 1 câu để xác nhận kết nối API Gemini thành công.",
        "Bạn là hệ thống kiểm tra kết nối API."
      );
      setTestStatus("success");
      setTestMessage(`Kết nối thành công với ${res.model}! Sẵn sàng hoạt động.`);
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err?.message || "Lỗi kiểm tra API Key.");
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
            <Sparkles size={16} className="text-primary animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground truncate">
                AI Dự Đoán & Lên Kế Hoạch Lương
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-mono font-semibold shrink-0">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Phân tích số liệu thực tế & tính chỉ tiêu hành động theo ngày
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
            title="Cấu hình Gemini API Key & Model"
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
              Mục tiêu lương mong muốn
            </label>
            <div className="relative">
              <input
                type="number"
                step="500000"
                value={targetSalary}
                onChange={(e) => setTargetSalary(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary pr-8"
              />
              <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-semibold">
                đ
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {[15000000, 18000000, 20000000, 25000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetSalary(preset)}
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono transition-colors ${
                    targetSalary === preset
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {(preset / 1000000).toFixed(0)}Tr
                </button>
              ))}
            </div>
          </div>

          {/* Current Date in Month */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Hôm nay là ngày
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
            <p className="text-[9px] text-muted-foreground mt-1">
              Còn {predictionMetrics.remainingCalendarDays} ngày lịch đến hết tháng
            </p>
          </div>

          {/* Remaining Days Off */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Ngày nghỉ còn lại
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
            <p className="text-[9px] text-primary font-semibold mt-1">
              Thực chiến còn {predictionMetrics.remainingWorkingDays} ngày làm việc
            </p>
          </div>
        </div>

        {/* Realtime KPI vs Target Breakdown Metrics Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/60">
          <div className="p-2 rounded-lg bg-card border border-border/70 space-y-0.5">
            <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
              <Briefcase size={10} />
              Công còn lại
            </span>
            <div className="text-xs font-mono font-extrabold text-foreground">
              {predictionMetrics.remainingWorkingDays} ngày
            </div>
            <span className="text-[9px] text-muted-foreground block">
              (Trừ {remainingDaysOff} ngày nghỉ)
            </span>
          </div>

          <div className="p-2 rounded-lg bg-card border border-border/70 space-y-0.5">
            <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
              <Target size={10} />
              {predictionMetrics.isCurrentKpiAchieved ? "Chuẩn KPI tháng" : "Để lấy Lương cứng"}
            </span>
            <div className="text-xs font-mono font-extrabold text-foreground">
              {predictionMetrics.isCurrentKpiAchieved
                ? "Đã có Lương cứng 🎉"
                : `${predictionMetrics.dailyPhotosForKpi} file/ngày`}
            </div>
            <span className="text-[9px] text-muted-foreground block truncate">
              {predictionMetrics.isCurrentKpiAchieved
                ? `Vượt +${(calc.actualPhotos - calc.monthKpi).toLocaleString("vi-VN")} file`
                : `Thiếu ${predictionMetrics.kpiShortfall.toLocaleString("vi-VN")} file (Hiện tính ${salaryConfig.unitPriceKpi.toLocaleString("vi-VN")}đ/file)`}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 space-y-0.5">
            <span className="text-[10px] text-primary font-bold block flex items-center gap-1">
              <TrendingUp size={10} />
              Để đạt {targetSalary.toLocaleString("vi-VN")} đ
            </span>
            <div className="text-xs font-mono font-extrabold text-primary">
              {predictionMetrics.dailyPhotosForTarget > 0
                ? `${predictionMetrics.dailyPhotosForTarget} file/ngày`
                : "Đã vượt mục tiêu 🚀"}
            </div>
            <span className="text-[9px] text-muted-foreground block truncate">
              {predictionMetrics.salaryGap > 0
                ? `Tổng ${predictionMetrics.targetTotalPhotos.toLocaleString("vi-VN")} file (gồm +${predictionMetrics.effBonusIncrease.toLocaleString("vi-VN")}đ thưởng hiệu suất)`
                : "Đã đạt mức lương mong muốn"}
            </span>
          </div>
        </div>

        {/* Realtime VIP Sensitivity & Milestone Insights */}
        <div className="p-2 rounded-lg bg-card/90 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Crown size={12} className="text-amber-500" />
              Nếu có thêm VIP:
            </span>
            {predictionMetrics.vipScenarios.map((s) => (
              <span
                key={s.extraVipSets}
                className="px-1.5 py-0.5 rounded bg-muted font-mono font-medium border border-border/60 text-foreground"
              >
                +{s.extraVipSets} VIP: <strong>{s.dailyPhotos}</strong> file/ngày
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 text-primary font-medium shrink-0">
            <Zap size={11} className="text-primary" />
            <span>
              Mốc {predictionMetrics.nextEffThreshold.toLocaleString("vi-VN")} file: còn{" "}
              <strong>{predictionMetrics.photosToNextEffThreshold.toLocaleString("vi-VN")} file</strong> (+500k)
            </span>
          </div>
        </div>
      </div>

      {/* 3. CHATBOT STREAM */}
      <div className="h-64 sm:h-72 overflow-y-auto p-3.5 space-y-3 custom-scrollbar bg-background/50">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
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
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                ) : (
                  <MarkdownView text={msg.content} />
                )}

                {/* Copy button for assistant responses */}
                {!isUser && (
                  <div className="mt-2 pt-1 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="opacity-70 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="hover:text-foreground flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-muted"
                      title="Sao chép câu trả lời"
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check size={11} className="text-emerald-500" />
                          <span className="text-emerald-500">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Sao chép</span>
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
              <Sparkles size={12} className="animate-spin" />
            </div>
            <div className="bg-card border border-border/80 rounded-xl rounded-tl-none p-3 shadow-2xs space-y-2 max-w-[85%]">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span>AI đang phân tích dữ liệu và lên lộ trình tác chiến...</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Quét KPI: {calc.monthKpi} file • Thực tế: {calc.actualPhotos} file • Mục tiêu:{" "}
                {targetSalary.toLocaleString("vi-VN")} đ
              </p>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 4. QUICK SUGGESTION CHIPS */}
      <div className="px-3 py-2 bg-muted/10 border-t border-border/60 overflow-x-auto custom-scrollbar flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
          Gợi ý nhanh:
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
          placeholder="Nhập câu hỏi hoặc yêu cầu AI dự đoán lương..."
          className="flex-1 px-3 py-2 text-xs rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
        />

        <button
          type="button"
          onClick={() => handleAskAi()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
          title="Bấm để Gemini AI phân tích và dự đoán"
        >
          <Sparkles size={13} />
          <span>AI Dự đoán</span>
        </button>
      </div>

      {/* 6. SETTINGS MODAL (GEMINI API KEY & MODEL) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-4 space-y-4 text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Cấu Hình Gemini AI Toàn Hệ Thống
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {/* Note about persistence */}
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-[11px] leading-relaxed">
              💡 <strong>Lưu ý:</strong> API Key được lưu tập trung trong bộ nhớ máy (
              <code>localStorage</code>) và sẽ được dùng chung cho tính năng Dự đoán lương cũng như
              toàn bộ các dịch vụ AI tương lai của MVD SuperApp.
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
                  title={showApiKey ? "Ẩn Key" : "Hiện Key"}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span>Key mặc định của hệ thống đã được nạp sẵn.</span>
                <button
                  type="button"
                  onClick={() => setApiKeyInput(DEFAULT_GEMINI_API_KEY)}
                  className="text-primary hover:underline font-semibold"
                >
                  Khôi phục Key gốc
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                Mô hình AI (Model)
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:border-primary"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
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
                      ? "Đang gửi truy vấn thử nghiệm đến Google Gemini..."
                      : testStatus === "success"
                      ? "Kết nối thành công!"
                      : "Lỗi kết nối!"}
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
                <Zap size={12} className="text-amber-500" />
                <span>Kiểm tra kết nối</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
                >
                  Lưu cấu hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
