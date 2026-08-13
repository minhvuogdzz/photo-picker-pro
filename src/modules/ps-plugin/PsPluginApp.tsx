import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eraser, Settings, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export default function PsPluginApp() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleRunAutomation = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const result = await invoke<string>("run_cleanup_automation");
      setMessage({ text: result, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.toString(), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#18181b] to-[#09090b] rounded-3xl p-8 relative overflow-hidden animate-fade-in">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px]" />

      <div className="max-w-md w-full z-10 flex flex-col items-center text-center">
        
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400">
          <Eraser size={32} />
        </div>

        {/* Titles */}
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">Image Cleanup Worker</h1>
        <p className="text-sm text-white/50 mb-8 max-w-sm">
          Bảng điều khiển từ xa. Chạy tự động hóa nhận diện và làm sạch ảnh trực tiếp trong Photoshop.
        </p>

        {/* Feature list */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-left">
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Settings size={14} /> Cơ chế hoạt động
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-white/80">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Giao tiếp trực tiếp với Photoshop đang mở, không cần cài đặt Plugin.
            </li>
            <li className="flex items-start gap-3 text-sm text-white/80">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Sử dụng Content-Aware Fill nội bộ siêu mượt.
            </li>
            <li className="flex items-start gap-3 text-sm text-white/80">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              Mô phỏng: Tự động khoanh vùng rác theo tọa độ định sẵn.
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRunAutomation}
          disabled={running}
          className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            running
              ? "bg-emerald-500/20 text-emerald-300 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
          }`}
        >
          {running ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Đang truyền lệnh sang Photoshop...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Tạo Mask & Xóa rác (Content-Aware)
            </>
          )}
        </button>

        {/* Message */}
        {message && (
          <div className={`w-full mt-4 p-4 rounded-lg text-xs font-medium text-left ${
            message.type === "success" 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            <span className="block mb-1 font-bold">{message.type === "success" ? "Thành công" : "Lỗi"}</span>
            {message.text}
          </div>
        )}

      </div>
    </div>
  );
}
