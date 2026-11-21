import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  HelpCircle,
  Copy,
  Check,
  Layers,
  FileText,
  Hash,
  Search,
  ArrowRight,
  BookOpen,
  Info,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useTranslation } from "@/core/lib/i18n";

interface FilterSyntaxHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "prefix" | "separator" | "contains" | "formats";

export function FilterSyntaxHelpModal({ isOpen, onClose }: FilterSyntaxHelpModalProps) {
  const { tr } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("prefix");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rawCodeInput = useAppStore((s) => s.rawCodeInput);
  const setRawCodeInput = useAppStore((s) => s.setRawCodeInput);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore fallback
    }
  };

  const handleApplySample = (sample: string) => {
    setRawCodeInput(sample);
    onClose();
  };

  if (!isOpen) return null;

  const samplePrefixCode = `ABC1234\n1235\n1236\nDEF1234\n1235\n1236`;
  const sampleDashCode = `HPP01099-01006-01078-00987\nZHA_0555-0573-0576`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-FilterSyntaxHelpModal-1"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground border border-border/80 shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[85vh] max-h-[720px] min-h-[500px] my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border/80 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/25 flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="dlg-FilterSyntaxHelpModal-1" className="text-sm font-bold text-foreground">
                  {tr("Hướng dẫn cú pháp & Xử lý mã trùng tiền tố", "Syntax Guide & Multi-Camera Prefix Handling")}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                  {tr("Mẹo Studio", "Studio Tips")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {tr(
                  "Bí quyết lọc nhanh và chính xác khi cùng thư mục có nhiều máy hoặc thợ chụp trùng số đuôi",
                  "Best practices for fast, accurate photo matching when multiple cameras share overlapping sequence numbers"
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            title={tr("Đóng (Esc)", "Close (Esc)")} aria-label={tr("Đóng (Esc)", "Close (Esc)")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="shrink-0 px-5 pt-3 pb-1 border-b border-border/60 bg-muted/10 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("prefix")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "prefix"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Layers size={13} />
            <span>{tr("1. Kế thừa tiền tố", "1. Prefix Inheritance")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("separator")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "separator"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Hash size={13} />
            <span>{tr("2. Bỏ qua dấu gạch (_)", "2. Ignore Separators (_)")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contains")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "contains"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Search size={13} />
            <span>{tr("3. Chế độ Chứa", "3. Contains Mode")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("formats")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "formats"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <FileText size={13} />
            <span>{tr("4. Các dạng dán mã", "4. Supported Input Formats")}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* TAB 1: Kế thừa tiền tố */}
          {activeTab === "prefix" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-primary">
                  <Camera size={14} />
                  <span>{tr("Giải quyết bài toán: Cùng thư mục có nhiều máy trùng số đuôi", "Handling multiple cameras sharing numeric suffixes in one folder")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tr(
                    "Khi khách hàng chọn ảnh từ nhiều máy (ví dụ Máy 1 - ABC và Máy 2 - DEF). Khách thường chỉ gõ đầu mã ở ảnh đầu tiên, các ảnh sau chỉ ghi số đuôi.",
                    "When customers pick shots from multiple cameras (e.g., Camera 1 - ABC and Camera 2 - DEF), they often write the prefix once on the first image and omit it below."
                  )}
                </p>
                <div className="text-[11px] text-foreground font-medium bg-background/60 p-2.5 rounded-lg border border-border/40">
                  <strong>{tr("Cơ chế tự động:", "Automatic behavior:")}</strong>{" "}
                  {tr("App sẽ ghi nhớ tiền tố của mã đầu tiên và", "The parser remembers the active prefix and")}{" "}
                  <span className="text-primary font-semibold">
                    {tr("tự động áp tiền tố đó cho tất cả các mã số thuần túy bên dưới", "applies it to subsequent number-only lines")}
                  </span>{" "}
                  {tr("cho đến khi gặp một đầu mã mới!", "until a new prefix appears!")}
                </div>
              </div>

              {/* Code Example Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>{tr("Ví dụ thực tế khách gửi:", "Real-world example:")}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(samplePrefixCode, "prefix-sample")}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "prefix-sample" ? (
                      <>
                        <Check size={11} className="text-emerald-500" />
                        <span className="text-emerald-500">{tr("Đã chép", "Copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>{tr("Sao chép mẫu", "Copy sample")}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative font-mono text-[11px] bg-muted/40 border border-border rounded-xl p-3 text-foreground/90 space-y-1">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">ABC1234</span>
                    <span className="text-[10px] text-muted-foreground font-sans">{tr("← Máy ABC (đặt tiền tố)", "← Camera ABC (sets prefix)")}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1235</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">{tr("← Tự hiểu: ABC1235 (khớp ABC_1235.jpg)", "← Resolved: ABC1235 (matches ABC_1235.jpg)")}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1236</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">{tr("← Tự hiểu: ABC1236 (khớp ABC_1236.jpg)", "← Resolved: ABC1236 (matches ABC_1236.jpg)")}</span>
                  </div>
                  <div className="border-t border-border/40 my-1 pt-1 flex items-center justify-between py-0.5">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">DEF1234</span>
                    <span className="text-[10px] text-muted-foreground font-sans">{tr("← Gặp máy DEF (đổi sang tiền tố DEF)", "← Camera DEF (switches prefix to DEF)")}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1235</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans">{tr("← Tự hiểu: DEF1235 (khớp DEF1235.jpg)", "← Resolved: DEF1235 (matches DEF1235.jpg)")}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1236</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans">{tr("← Tự hiểu: DEF1236 (khớp DEF1236.jpg)", "← Resolved: DEF1236 (matches DEF1236.jpg)")}</span>
                  </div>
                </div>
              </div>

              {/* Reset Prefix Hint */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info size={13} />
                  <span>{tr("Cách ngắt hoặc xoá tiền tố chữ (Chỉ tìm theo số):", "How to clear the inherited prefix (match digits only):")}</span>
                </div>
                <p className="leading-relaxed">
                  {tr("Nếu bạn muốn bỏ qua toàn bộ tiền tố chữ (ví dụ:", "To clear any inherited prefix (e.g.,")}{" "}
                  <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">IGM0088</code>,{" "}
                  <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">IMG0138</code>
                  {tr(") và chỉ tìm theo số thuần túy (", ") and match purely by numbers (")}
                  <code className="font-mono font-bold">0088</code>, <code className="font-mono font-bold">0138</code>
                  {tr("), chỉ cần gõ ", "), put ")}
                  <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">@clear</code> {tr("hoặc", "or")}{" "}
                  <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">@none</code>{" "}
                  {tr("trên một dòng riêng.", "on its own line.")}
                </p>
                <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
                  {tr(
                    "Tính năng này hoạt động hiệu quả cho cả chế độ Chính xác lẫn Chứa, giúp khớp đúng file dù khách gõ sai tiền tố máy ảnh.",
                    "Works in both Exact and Contains modes, helping find shots even when the camera prefix was typed incorrectly."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Bỏ qua dấu gạch */}
          {activeTab === "separator" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} />
                  <span>{tr("Chuẩn hóa bỏ qua dấu gạch (_) và khoảng cách", "Automatic normalization of underscores (_), dashes (-), and spaces")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tr("File trong máy ảnh thường có cấu trúc dạng:", "Camera filenames commonly look like:")}{" "}
                  <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC_1234.JPG</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">_MG_1234.CR2</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">DSC_0123.JPG</code>.
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tr("Khách hàng khi gõ trên điện thoại thường bỏ qua dấu gạch dưới và chỉ gõ liền là:", "Customers typing on mobile often skip underscores and send:")}{" "}
                  <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC1234</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">MG1234</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">DSC0123</code>.
                </p>
              </div>

              {/* Comparison Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="bg-muted/40 px-3 py-2 border-b border-border font-semibold text-[11px] flex justify-between">
                  <span>{tr("Khách gõ nhập vào", "Customer Input")}</span>
                  <span>{tr("Tên file gốc trên đĩa", "Filename on Disk")}</span>
                  <span>{tr("Kết quả so khớp", "Match Result")}</span>
                </div>
                <div className="divide-y divide-border/40 font-mono text-[11px]">
                  <div className="px-3 py-2 flex items-center justify-between bg-card">
                    <span className="text-foreground">ABC1234</span>
                    <span className="text-muted-foreground">ABC_1234.JPG</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> {tr("Khớp 100%", "100% Match")}
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-muted/10">
                    <span className="text-foreground">ABC-1234</span>
                    <span className="text-muted-foreground">ABC_1234.CR2</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> {tr("Khớp 100%", "100% Match")}
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-card">
                    <span className="text-foreground">MG1234</span>
                    <span className="text-muted-foreground">_MG_1234.CR3</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> {tr("Khớp 100%", "100% Match")}
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-muted/10">
                    <span className="text-foreground">ZHA 0401</span>
                    <span className="text-muted-foreground">ZHA_0401.JPG</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> {tr("Khớp 100%", "100% Match")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed p-2.5 rounded-lg bg-muted/20 border border-border/50">
                <strong>{tr("Lời khuyên:", "Tip:")}</strong>{" "}
                {tr(
                  "Hãy giữ chế độ Chính xác (Exact) vì app đã tự động bỏ qua các ký tự phân cách này. Bạn không cần phải chuyển sang chế độ \"Chứa\" nữa!",
                  "Keep Exact mode selected—these separator characters are normalized automatically without switching to Contains."
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Chế độ Chứa */}
          {activeTab === "contains" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-blue-600 dark:text-blue-400">
                  <Search size={14} />
                  <span>{tr("Chế độ \"Chứa\" có ngữ cảnh (Smart Contains)", "Context-Aware Contains Mode")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tr("Trước đây, ở chế độ \"Chứa\", nếu gõ", "In standard substring mode, typing")}{" "}
                  <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC1234</code>{" "}
                  {tr(", app chỉ tìm mỗi số", "matched every file containing")}{" "}
                  <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">1234</code>{" "}
                  {tr(", dẫn đến việc cả file", ", causing")}{" "}
                  <code className="font-mono text-foreground">ABC_1234</code> {tr("và", "and")}{" "}
                  <code className="font-mono text-foreground">DEF1234</code>{" "}
                  {tr("đều bị coi là trùng mã và bốc bừa file đầu tiên.", "to collide arbitrarily.")}
                </p>
                <div className="text-[11px] text-foreground font-medium bg-background/60 p-2.5 rounded-lg border border-border/40 space-y-1">
                  <div>
                    <strong>{tr("Ưu tiên thông minh:", "Smart Prefix Priority:")}</strong>{" "}
                    {tr("Khi mã có tiền tố (ví dụ", "When a code includes a prefix (e.g.,")}{" "}
                    <code className="font-mono font-bold text-primary">ABC1234</code>
                    {tr(
                      "), chế độ Chứa sẽ ưu tiên lấy file có chứa cả chữ \"ABC\" lẫn số \"1234\" để không chọn nhầm máy khác.",
                      "), Contains prioritizes files matching both \"ABC\" and \"1234\" so it never picks another camera."
                    )}
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    <strong>{tr("Chống sót mã khi khách gõ nhầm chữ:", "Typo Resilience:")}</strong>{" "}
                    {tr("Nếu khách gõ lộn tiền tố (ví dụ: gõ nhầm", "If the customer mistyped the prefix (e.g.,")}{" "}
                    <code className="font-mono font-bold">ACB1234</code> {tr("thay vì", "instead of")}{" "}
                    <code className="font-mono font-bold">ABC1234</code>, {tr("hoặc", "or")}{" "}
                    <code className="font-mono font-bold">IGM0088</code> {tr("thay vì", "instead of")}{" "}
                    <code className="font-mono font-bold">IMG0088</code>
                    {tr("), app sẽ tự động tìm theo số để vẫn tìm ra ảnh cho bạn!", "), it gracefully falls back to matching by number so no photo is missed!")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-foreground">{tr("Khi nào nên dùng chế độ Chứa?", "When should you use Contains mode?")}</h4>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-4 leading-relaxed">
                  <li>
                    {tr("Khi tên file gốc có gắn thêm tên khách hoặc ngày tháng ở giữa:", "When source filenames include extra customer names or dates:")} <br />
                    <code className="font-mono text-foreground">20260924_ABC_CoDau_1234.JPG</code> → {tr("Gõ", "Typing")}{" "}
                    <code className="font-mono text-foreground font-bold">ABC1234</code> {tr("vẫn tìm thấy!", "still finds it!")}
                  </li>
                  <li>
                    {tr("Khi khách chụp thêm bản edit có hậu tố:", "When edited variants have suffixes:")} <br />
                    <code className="font-mono text-foreground">ABC_1234_retouch.JPG</code> → {tr("Vẫn tìm thấy!", "Still matched!")}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: Các định dạng dán mã */}
          {activeTab === "formats" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                {tr(
                  "App hỗ trợ tự động nhận diện và làm sạch mã từ Zalo, Messenger, Excel, Google Sheets, Ghi chú điện thoại:",
                  "Automatically detects and cleans customer codes pasted from Zalo, Messenger, Excel, Google Sheets, and Notes:"
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {tr("Gạch ngang nối từ 3 mã trở lên", "Hyphenated chains (3+ codes)")}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    HPP01099-01006-01078-00987
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {tr("→ Tự động tách từng mã và ăn theo HPP", "→ Automatically splits and inherits HPP prefix")}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {tr("Dấu phẩy hoặc chấm phẩy", "Comma or semicolon separated")}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ABC1234, 1235, 1236; DEF1234
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    {tr("→ Tự động phân tách mỗi mã một dòng", "→ Splits cleanly into one code per line")}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {tr("Khoảng trắng / Dấu cách", "Space-separated codes")}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ABC1234 1235 1236 DEF1234
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    {tr("→ Tự động chuyển thành danh sách dọc", "→ Formats into a clean vertical list")}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {tr("Kèm câu chào / Lời nhắn", "Chat messages & extra text")}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {tr("\"Em chọn ảnh cưới: ABC1234, 1235 ạ\"", "\"My wedding picks: ABC1234, 1235 please\"")}
                  </p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400">
                    {tr("→ Tự lọc bỏ chữ thừa, giữ lại đúng mã", "→ Strips filler text and keeps only valid codes")}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1 sm:col-span-2">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    {tr("Dải số liên tiếp", "Sequential ranges")}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    0450-0465 · 0450..0465 · IMG_0450~0465
                  </p>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400">
                    {tr("→ Tự mở rộng thành đủ 16 mã 0450, 0451 … 0465 (tối đa 500 mã mỗi dải)", "→ Expands all 16 codes 0450–0465 (up to 500 codes per range)")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {tr(
                      "Chỉ áp dụng khi 2 số đứng riêng, cùng số chữ số và số sau lớn hơn số trước.",
                      "Applies when two standalone numbers share the same digit length with end > start."
                    )}
                  </p>
                </div>
              </div>

              {/* Sample Dash Quick Copy */}
              <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    {tr("Thử dán định dạng gạch ngang:", "Try hyphen-chain format:")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    HPP01099-01006-01078-00987...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplySample(sampleDashCode)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  {tr("Dán vào ô lọc", "Insert Sample")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/80 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            {!rawCodeInput.trim() && (
              <button
                type="button"
                onClick={() => handleApplySample(samplePrefixCode)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer font-medium"
              >
                <span>{tr("Dán thử danh sách mẫu", "Insert sample list")}</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            {tr("Đã hiểu", "Got it")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
