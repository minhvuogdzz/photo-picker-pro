import { useConvertStore } from "@/core/stores/useConvertStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UploadCloud, FolderOpen, Image as ImageIcon, Play, FileDown, CheckCircle2, AlertCircle, X, ChevronDown, Zap, FileImage, Layers, Settings2, FolderDown } from "lucide-react";
import { useEffect, useState } from "react";

export default function MvdConvertApp() {
  const store = useConvertStore();
  const [isHovering, setIsHovering] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const formats = ["JPG", "PNG", "WEBP", "TIFF", "BMP"];

  // Handle Drag & Drop & Progress
  useEffect(() => {
    let unlistenDragEnter: () => void;
    let unlistenDragDrop: () => void;
    let unlistenProgress: () => void;
    let unlistenLog: () => void;

    async function setupListeners() {
      unlistenDragEnter = await listen('tauri://drag-enter', () => {
        setIsHovering(true);
      });
      
      unlistenDragDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        setIsHovering(false);
        if (event.payload.paths && event.payload.paths.length > 0) {
          store.addInputFolders(event.payload.paths);
        }
      });

      unlistenProgress = await listen<any>('convert-progress', (event) => {
        store.setProgress(event.payload);
      });

      unlistenLog = await listen<string>('convert-log', (event) => {
        store.addLog(event.payload);
      });
    }

    setupListeners();
    return () => {
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenDragDrop) unlistenDragDrop();
      if (unlistenProgress) unlistenProgress();
      if (unlistenLog) unlistenLog();
    };
  }, [store]);

  const handleSelectInput = async () => {
    const selected = await open({
      directory: true,
      multiple: true,
      title: "Chọn thư mục đầu vào",
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      store.addInputFolders(paths);
    }
  };

  const handleSelectOutput = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Chọn thư mục xuất ảnh",
    });
    if (selected && typeof selected === "string") {
      store.setOutputFolder(selected);
    }
  };

  const handleStartConvert = async () => {
    if (store.inputFolders.length === 0) {
      alert("Vui lòng thêm ảnh hoặc thư mục vào trước!");
      return;
    }
    if (!store.outputFolder) {
      alert("Vui lòng chọn thư mục xuất ảnh!");
      return;
    }
    store.setIsConverting(true);
    store.setProgress(null);
    store.clearLogs();
    try {
      await invoke("run_convert_batch", {
        inputs: store.inputFolders,
        outputFolder: store.outputFolder,
        targetFormat: store.targetFormat,
        quality: store.quality,
        exportJpg2048: store.exportJpg2048,
      });
    } catch (e) {
      alert("Có lỗi xảy ra: " + e);
    } finally {
      store.setIsConverting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#064e3b]/30 rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl animate-fade-in">
      
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-5 border-b border-white/10 bg-black/40 backdrop-blur-md flex justify-between items-center shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="text-black" size={20} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white drop-shadow-md">MVD Convert</h2>
            <p className="text-xs text-emerald-300/80 font-medium mt-0.5">Siêu tốc độ - Giữ nguyên Profile màu</p>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 flex flex-row w-full overflow-hidden relative z-10">
        
        {/* COLUMN 1: INPUT */}
        <div className="flex-1 border-r border-white/10 flex flex-col bg-white/[0.02] backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-emerald-400">
              <FolderOpen size={14} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Nguồn Đầu Vào</h3>
          </div>
          
          <div className="p-6 flex flex-col h-full overflow-hidden gap-5">
            <div 
              className={`shrink-0 p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 text-center relative group ${
                isHovering 
                  ? 'border-emerald-400 bg-emerald-500/20 scale-[1.02] shadow-[0_0_30px_rgba(52,211,153,0.15)]' 
                  : 'border-white/15 bg-black/20 hover:border-emerald-500/40 hover:bg-white/5'
              }`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${isHovering ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 group-hover:text-emerald-400 group-hover:bg-emerald-500/10'}`}>
                <UploadCloud size={24} />
              </div>
              <p className="text-sm font-bold text-white/90 mb-1">Kéo thả ảnh / thư mục</p>
              <p className="text-xs text-white/40 mb-4">CR2, CR3, ARW, HEIC, JPG...</p>
              <button 
                onClick={handleSelectInput}
                className="px-5 py-2.5 bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs font-bold rounded-xl transition-all border border-white/10 hover:border-emerald-500/30 shadow-sm"
              >
                Chọn từ máy tính
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden glass-panel rounded-2xl border border-white/10 bg-black/40">
              <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={12} /> Danh sách chờ ({store.inputFolders.length})
                </span>
                {store.inputFolders.length > 0 && (
                  <button onClick={() => store.clearInputFolders()} className="text-[10px] text-destructive/80 hover:text-destructive font-semibold transition-colors">Xóa tất cả</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {store.inputFolders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 gap-2 opacity-50">
                    <FileImage size={32} />
                    <span className="text-xs font-medium">Chưa có dữ liệu</span>
                  </div>
                ) : (
                  store.inputFolders.map(f => (
                    <div key={f} className="flex justify-between items-center text-xs bg-white/5 p-3 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors group">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileImage size={14} className="text-emerald-400 shrink-0" />
                        <span className="truncate text-white/80 font-medium">{f.split(/[\\/]/).pop()}</span>
                      </div>
                      <button 
                        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-destructive hover:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100 text-white/50 bg-white/5" 
                        onClick={() => store.removeInputFolder(f)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: SETTINGS */}
        <div className="flex-1 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md">
          <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-emerald-400">
              <Settings2 size={14} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Cấu Hình</h3>
          </div>
          
          <div className="p-6 flex flex-col gap-6 overflow-y-auto h-full">
            {/* Format Setting */}
            <div className="flex flex-col gap-3 p-5 glass-panel rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-colors bg-white/5 shrink-0">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FileDown size={12} /> Định dạng đích
              </label>
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl text-sm font-black text-white transition-all shadow-inner"
                >
                  <span className="text-emerald-400 text-base">{store.targetFormat}</span>
                  <ChevronDown size={18} className="text-white/40" />
                </button>
                
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-20 py-2 overflow-hidden animate-slide-up backdrop-blur-xl">
                      {formats.map(f => (
                        <button 
                          key={f}
                          onClick={() => { store.setTargetFormat(f); setDropdownOpen(false); }}
                          className={`w-full flex items-center px-5 py-3 text-sm font-bold transition-colors ${store.targetFormat === f ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                        >
                          {store.targetFormat === f && <CheckCircle2 size={14} className="mr-2" />}
                          {f}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quality Slider */}
            <div className="flex flex-col gap-4 p-5 glass-panel rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-colors bg-white/5 shrink-0">
              <div className="flex flex-wrap justify-between items-center gap-y-2">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={12} /> Chất lượng xuất
                </label>
                <span className="text-xs font-bold text-emerald-400">
                  {store.quality === 4 ? "MAX (100%)" : store.quality === 3 ? "Cao (80%)" : store.quality === 2 ? "Trung bình (60%)" : "Thấp (40%)"}
                </span>
              </div>
              <input 
                type="range" 
                min="1" max="4" step="1" 
                value={store.quality} 
                onChange={(e) => store.setQuality(Number(e.target.value))}
                className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
              />
              <div className="flex justify-between text-[10px] font-medium text-white/40 px-1">
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>Max</span>
              </div>
            </div>

            {/* JPG 2048 Toggle */}
            <div className="flex items-start gap-4 p-5 glass-panel rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-colors bg-white/5 mt-auto">
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={store.exportJpg2048}
                  onChange={(e) => store.setExportJpg2048(e.target.checked)}
                />
                <div className="w-10 h-5 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 border border-white/10"></div>
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-white/90">Xuất JPG 2048 (Chỉ RAW)</span>
                <span className="text-[10px] text-white/40 leading-relaxed">
                  Tự động chuyển đổi các file RAW sang định dạng JPG với cạnh dài tối đa 2048px (rất nhẹ để gửi ảnh xem trước).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: OUTPUT & ACTION */}
        <div className="flex-1 flex flex-col bg-white/[0.01] backdrop-blur-sm relative">
          <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-emerald-400">
              <FolderDown size={14} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Xử lý & Xuất file</h3>
          </div>
          
          <div className="p-6 flex flex-col h-full overflow-hidden gap-5">
            {/* Output Selector */}
            <div className="flex flex-col gap-3 p-5 glass-panel rounded-2xl border border-white/10 bg-white/5 shrink-0">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Nơi lưu trữ</label>
                <button 
                  onClick={handleSelectOutput}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors border border-emerald-500/20"
                >
                  <FolderOpen size={12} /> CHỌN FOLDER
                </button>
              </div>
              
              {store.outputFolder ? (
                <div className="text-xs text-emerald-100 truncate bg-black/40 px-4 py-3 rounded-xl border border-emerald-500/30 font-medium flex items-center gap-2 shadow-inner" title={store.outputFolder}>
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{store.outputFolder}/<span className="font-bold text-emerald-400">mvdconvert...</span></span>
                </div>
              ) : (
                <div className="text-xs text-amber-400 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/30 flex items-center gap-2 font-semibold">
                  <AlertCircle size={14} /> Chưa thiết lập thư mục xuất
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="bg-black/40 p-5 rounded-2xl border border-white/10 flex flex-col gap-3 shrink-0 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Zap size={60} />
              </div>
              <div className="flex justify-between items-end relative z-10">
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                    {store.progress ? store.progress.percentage : 0}%
                  </span>
                  <span className="text-[10px] font-bold text-white/40 mt-1 tracking-wider uppercase">
                    Đã xử lý: {store.progress ? store.progress.current : 0} / {store.progress ? store.progress.total : 0}
                  </span>
                </div>
                {store.isConverting && <div className="loader-spin text-emerald-400 mb-2"><Play size={18} /></div>}
              </div>
              
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5 relative z-10">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 relative"
                  style={{ width: `${store.progress ? store.progress.percentage : 0}%` }}
                >
                  <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
                </div>
              </div>
              
              <div className="text-[10px] font-medium text-emerald-200/60 truncate h-4 relative z-10">
                {store.progress?.currentFile ? `Đang convert: ${store.progress.currentFile.split(/[\\/]/).pop()}` : "Sẵn sàng hoạt động..."}
              </div>
            </div>
            
            {/* Logs */}
            <div className="flex-1 bg-black/60 rounded-2xl border border-white/10 p-1 flex flex-col overflow-hidden relative shadow-inner">
              <div className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar space-y-2">
                {store.logs.map((log, i) => (
                  <div key={i} className="text-[10px] font-mono text-emerald-100/50 break-all leading-relaxed">
                    <span className="text-emerald-500/70 mr-2 select-none">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </div>
                ))}
                {store.logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-white/10 gap-2">
                    <Zap size={24} className="opacity-20" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">System Ready</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Button */}
            <div className="shrink-0 mt-1">
              <button 
                onClick={handleStartConvert}
                disabled={store.isConverting || store.inputFolders.length === 0}
                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all duration-300 relative overflow-hidden group ${
                  store.isConverting 
                    ? 'bg-emerald-500/20 text-emerald-200 cursor-not-allowed border border-emerald-500/30' 
                    : store.inputFolders.length === 0
                    ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] hover:-translate-y-1'
                }`}
              >
                {store.isConverting ? (
                  <>ĐANG XỬ LÝ DỮ LIỆU...</>
                ) : (
                  <>
                    <FileDown size={20} /> BẮT ĐẦU CHUYỂN ĐỔI
                    {!store.isConverting && store.inputFolders.length > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
