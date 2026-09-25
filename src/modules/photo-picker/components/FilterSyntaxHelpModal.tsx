import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  HelpCircle,
  Sparkles,
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

interface FilterSyntaxHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "prefix" | "separator" | "contains" | "formats";

export function FilterSyntaxHelpModal({ isOpen, onClose }: FilterSyntaxHelpModalProps) {
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
    <div
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
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Hướng dẫn cú pháp & Xử lý mã trùng tiền tố
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                  Mẹo Studio
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bí quyết lọc nhanh và chính xác khi cùng thư mục có nhiều máy hoặc thợ chụp trùng số đuôi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            title="Đóng (Esc)"
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
            <span>1. Kế thừa tiền tố</span>
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
            <span>2. Bỏ qua dấu gạch (_)</span>
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
            <span>3. Chế độ Chứa</span>
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
            <span>4. Các dạng dán mã</span>
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
                  <span>Giải quyết bài toán: Cùng thư mục có nhiều máy trùng số đuôi</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Khi khách hàng chọn ảnh từ nhiều máy (ví dụ Máy 1 - <strong className="text-foreground">ABC</strong> và Máy 2 - <strong className="text-foreground">DEF</strong>). Khách thường chỉ gõ đầu mã ở ảnh đầu tiên, các ảnh sau chỉ ghi số đuôi.
                </p>
                <div className="text-[11px] text-foreground font-medium bg-background/60 p-2.5 rounded-lg border border-border/40">
                  👉 <strong>Cơ chế tự động:</strong> App sẽ ghi nhớ tiền tố của mã đầu tiên và <span className="text-primary font-semibold">tự động áp tiền tố đó cho tất cả các mã số thuần túy bên dưới</span> cho đến khi gặp một đầu mã mới!
                </div>
              </div>

              {/* Code Example Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Ví dụ thực tế khách gửi:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(samplePrefixCode, "prefix-sample")}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "prefix-sample" ? (
                      <>
                        <Check size={11} className="text-emerald-500" />
                        <span className="text-emerald-500">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Sao chép mẫu</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative font-mono text-[11px] bg-muted/40 border border-border rounded-xl p-3 text-foreground/90 space-y-1">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">ABC1234</span>
                    <span className="text-[10px] text-muted-foreground font-sans">← Máy ABC (đặt tiền tố)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1235</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">← Tự hiểu: ABC1235 (khớp ABC_1235.jpg)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1236</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">← Tự hiểu: ABC1236 (khớp ABC_1236.jpg)</span>
                  </div>
                  <div className="border-t border-border/40 my-1 pt-1 flex items-center justify-between py-0.5">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">DEF1234</span>
                    <span className="text-[10px] text-muted-foreground font-sans">← Gặp máy DEF (đổi sang tiền tố DEF)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1235</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans">← Tự hiểu: DEF1235 (khớp DEF1235.jpg)</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-foreground">1236</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans">← Tự hiểu: DEF1236 (khớp DEF1236.jpg)</span>
                  </div>
                </div>
              </div>

              {/* Reset Prefix Hint */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info size={13} />
                  <span>Cách ngắt hoặc xoá tiền tố chữ (Chỉ tìm theo số):</span>
                </div>
                <p className="leading-relaxed">
                  Nếu bạn muốn bỏ qua toàn bộ tiền tố chữ (ví dụ: <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">IGM0088</code>, <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">IMG0138</code>) và chỉ tìm theo số thuần túy (<code className="font-mono font-bold">0088</code>, <code className="font-mono font-bold">0138</code>), chỉ cần gõ <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">@clear</code> hoặc <code className="bg-amber-500/15 px-1 py-0.2 rounded font-mono font-bold">@none</code> trên một dòng riêng.
                </p>
                <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
                  ✨ Tính năng này hoạt động hiệu quả cho cả chế độ <strong>Chính xác</strong> lẫn <strong>Chứa</strong>, giúp khớp đúng file dù khách gõ sai tiền tố máy ảnh.
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
                  <span>Chuẩn hóa bỏ qua dấu gạch (_) và khoảng cách</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  File trong máy ảnh thường có cấu trúc dạng: <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC_1234.JPG</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">_MG_1234.CR2</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">DSC_0123.JPG</code>.
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Khách hàng khi gõ trên điện thoại thường bỏ qua dấu gạch dưới và chỉ gõ liền là: <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC1234</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">MG1234</code>, <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">DSC0123</code>.
                </p>
              </div>

              {/* Comparison Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="bg-muted/40 px-3 py-2 border-b border-border font-semibold text-[11px] flex justify-between">
                  <span>Khách gõ nhập vào</span>
                  <span>Tên file gốc trên đĩa</span>
                  <span>Kết quả so khớp</span>
                </div>
                <div className="divide-y divide-border/40 font-mono text-[11px]">
                  <div className="px-3 py-2 flex items-center justify-between bg-card">
                    <span className="text-foreground">ABC1234</span>
                    <span className="text-muted-foreground">ABC_1234.JPG</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> Khớp 100%
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-muted/10">
                    <span className="text-foreground">ABC-1234</span>
                    <span className="text-muted-foreground">ABC_1234.CR2</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> Khớp 100%
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-card">
                    <span className="text-foreground">MG1234</span>
                    <span className="text-muted-foreground">_MG_1234.CR3</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> Khớp 100%
                    </span>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between bg-muted/10">
                    <span className="text-foreground">ZHA 0401</span>
                    <span className="text-muted-foreground">ZHA_0401.JPG</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12} /> Khớp 100%
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed p-2.5 rounded-lg bg-muted/20 border border-border/50">
                💡 <strong>Lời khuyên:</strong> Hãy giữ chế độ <strong>Chính xác (Exact)</strong> vì app đã tự động bỏ qua các ký tự phân cách này. Bạn không cần phải chuyển sang chế độ "Chứa" nữa!
              </div>
            </div>
          )}

          {/* TAB 3: Chế độ Chứa */}
          {activeTab === "contains" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-blue-600 dark:text-blue-400">
                  <Search size={14} />
                  <span>Chế độ "Chứa" có ngữ cảnh (Smart Contains)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Trước đây, ở chế độ "Chứa", nếu gõ <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">ABC1234</code>, app chỉ tìm mỗi số <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground">1234</code>, dẫn đến việc cả file <code className="font-mono text-foreground">ABC_1234</code> và <code className="font-mono text-foreground">DEF1234</code> đều bị coi là trùng mã và bốc bừa file đầu tiên.
                </p>
                <div className="text-[11px] text-foreground font-medium bg-background/60 p-2.5 rounded-lg border border-border/40 space-y-1">
                  <div>
                    ✨ <strong>Ưu tiên thông minh:</strong> Khi mã có tiền tố (ví dụ <code className="font-mono font-bold text-primary">ABC1234</code>), chế độ Chứa sẽ ưu tiên lấy file có chứa cả chữ "ABC" lẫn số "1234" để không chọn nhầm máy khác.
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    🛡️ <strong>Chống sót mã khi khách gõ nhầm chữ:</strong> Nếu khách gõ lộn tiền tố (ví dụ: gõ nhầm <code className="font-mono font-bold">ACB1234</code> thay vì <code className="font-mono font-bold">ABC1234</code>, hoặc <code className="font-mono font-bold">IGM0088</code> thay vì <code className="font-mono font-bold">IMG0088</code>), app sẽ <strong>tự động tìm theo số</strong> để vẫn tìm ra ảnh cho bạn!
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-foreground">Khi nào nên dùng chế độ Chứa?</h4>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-4 leading-relaxed">
                  <li>
                    Khi tên file gốc có gắn thêm tên khách hoặc ngày tháng ở giữa: <br />
                    <code className="font-mono text-foreground">20260924_ABC_CoDau_1234.JPG</code> → Gõ <code className="font-mono text-foreground font-bold">ABC1234</code> vẫn tìm thấy!
                  </li>
                  <li>
                    Khi khách chụp thêm bản edit có hậu tố: <br />
                    <code className="font-mono text-foreground">ABC_1234_retouch.JPG</code> → Vẫn tìm thấy!
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: Các định dạng dán mã */}
          {activeTab === "formats" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                App hỗ trợ tự động nhận diện và làm sạch mã từ <strong>Zalo, Messenger, Excel, Google Sheets, Ghi chú điện thoại</strong>:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Dấu gạch ngang nối liền
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    HPP01099-01006-01078-00987
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    → Tự động tách từng mã và ăn theo HPP
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Dấu phẩy hoặc chấm phẩy
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ABC1234, 1235, 1236; DEF1234
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    → Tự động phân tách mỗi mã một dòng
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Khoảng trắng / Dấu cách
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ABC1234 1235 1236 DEF1234
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    → Tự động chuyển thành danh sách dọc
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Kèm câu chào / Lời nhắn
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    "Em chọn ảnh cưới: ABC1234, 1235 ạ"
                  </p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400">
                    → Tự lọc bỏ chữ thừa, giữ lại đúng mã
                  </p>
                </div>
              </div>

              {/* Sample Dash Quick Copy */}
              <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Thử dán định dạng gạch ngang:
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
                  Dán vào ô lọc
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
                <span>Dán thử danh sách mẫu</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
