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
    <div className="w-full h-full flex flex-col bg-card/90 backdrop-blur-md rounded-xl border border-border overflow-hidden relative animate-fade-in text-foreground select-none">
      
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
            <Zap size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">MVD Convert</h2>
            <p className="text-[11px] text-muted-foreground">Chuyển đổi đa luồng hàng loạt · Giữ nguyên Color Profile</p>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 flex flex-row w-full overflow-hidden relative z-10 divide-x divide-border">
        
        {/* COLUMN 1: INPUT */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/30">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <FolderOpen size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Nguồn đầu vào</h3>
          </div>
          
          <div className="p-4 flex flex-col h-full overflow-hidden gap-3">
            <div 
              className={`shrink-0 p-5 rounded-xl border border-dashed flex flex-col items-center justify-center transition-colors text-center relative group ${
                isHovering 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-primary/10 text-primary">
                <UploadCloud size={20} />
              </div>
              <p className="text-xs font-semibold text-foreground mb-0.5">Kéo thả ảnh hoặc thư mục vào đây</p>
              <p className="text-[10px] text-muted-foreground mb-3">Hỗ trợ CR2, CR3, ARW, NEF, HEIC, JPG, PNG...</p>
              <button 
                onClick={handleSelectInput}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition-colors border border-border cursor-pointer shadow-sm"
              >
                Chọn từ máy tính
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-border bg-muted/10">
              <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-muted/20">
                <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-primary" /> Danh sách chờ ({store.inputFolders.length})
                </span>
                {store.inputFolders.length > 0 && (
                  <button onClick={() => store.clearInputFolders()} className="text-[10px] text-destructive hover:underline font-medium transition-colors cursor-pointer">Xóa tất cả</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {store.inputFolders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 py-8">
                    <FileImage size={24} className="opacity-40" />
                    <span className="text-[11px]">Chưa có thư mục nào được chọn</span>
                  </div>
                ) : (
                  store.inputFolders.map(f => (
                    <div key={f} className="flex justify-between items-center text-[11px] bg-card p-2 rounded-lg border border-border/60 hover:border-primary/30 transition-colors group">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileImage size={13} className="text-primary shrink-0" />
                        <span className="truncate text-foreground/90 font-medium">{f.split(/[\\/]/).pop()}</span>
                      </div>
                      <button 
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground cursor-pointer" 
                        onClick={() => store.removeInputFolder(f)}
                        title="Xóa"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: SETTINGS */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/20">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <Settings2 size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Cấu hình xuất</h3>
          </div>
          
          <div className="p-4 flex flex-col gap-3.5 overflow-y-auto h-full custom-scrollbar">
            {/* Format Setting */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-card/60">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileDown size={12} className="text-primary" /> Định dạng đích
              </label>
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold text-foreground transition-colors cursor-pointer"
                >
                  <span className="text-primary">{store.targetFormat}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
                
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-lg shadow-lg z-20 py-1 overflow-hidden animate-fade-in">
                      {formats.map(f => (
                        <button 
                          key={f}
                          onClick={() => { store.setTargetFormat(f); setDropdownOpen(false); }}
                          className={`w-full flex items-center px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${store.targetFormat === f ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'}`}
                        >
                          {store.targetFormat === f && <CheckCircle2 size={12} className="mr-1.5" />}
                          {f}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quality Slider */}
            <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-border bg-card/60">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 size={12} className="text-primary" /> Chất lượng xuất
                </label>
                <span className="text-[11px] font-semibold text-primary font-mono">
                  {store.quality === 4 ? "MAX (100%)" : store.quality === 3 ? "Cao (80%)" : store.quality === 2 ? "TB (60%)" : "Thấp (40%)"}
                </span>
              </div>
              <input 
                type="range" 
                min="1" max="4" step="1" 
                value={store.quality} 
                onChange={(e) => store.setQuality(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground px-0.5">
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>

            {/* JPG 2048 Toggle */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/60 mt-auto">
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={store.exportJpg2048}
                  onChange={(e) => store.setExportJpg2048(e.target.checked)}
                />
                <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary border border-border"></div>
              </label>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">Xuất JPG 2048 (Chỉ RAW)</span>
                <span className="text-[10px] text-muted-foreground leading-relaxed">
                  Tự động chuyển file RAW sang JPG cạnh dài 2048px (nhẹ để gửi xem trước).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: OUTPUT & ACTION */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/30">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <FolderDown size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Xử lý & Xuất file</h3>
          </div>
          
          <div className="p-4 flex flex-col h-full overflow-hidden gap-3">
            {/* Output Selector */}
            <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card/60 shrink-0">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Thư mục lưu trữ</label>
                <button 
                  onClick={handleSelectOutput}
                  className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-medium rounded-md transition-colors border border-border cursor-pointer"
                >
                  <FolderOpen size={11} /> Chọn folder
                </button>
              </div>
              
              {store.outputFolder ? (
                <div className="text-[11px] text-foreground truncate bg-muted/30 px-3 py-2 rounded-lg border border-border font-mono flex items-center gap-2" title={store.outputFolder}>
                  <CheckCircle2 size={13} className="text-primary shrink-0" />
                  <span className="truncate">{store.outputFolder}</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 flex items-center gap-2 font-medium">
                  <AlertCircle size={13} /> Chưa thiết lập thư mục xuất
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="p-3 rounded-xl border border-border bg-card/60 flex flex-col gap-2 shrink-0">
              <div className="flex justify-between items-end">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground font-mono">
                    {store.progress ? store.progress.percentage : 0}%
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    Đã xử lý: {store.progress ? store.progress.current : 0} / {store.progress ? store.progress.total : 0}
                  </span>
                </div>
                {store.isConverting && <div className="animate-spin text-primary"><Play size={14} /></div>}
              </div>
              
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${store.progress ? store.progress.percentage : 0}%` }}
                />
              </div>
              
              <div className="text-[10px] text-muted-foreground truncate h-3.5">
                {store.progress?.currentFile ? `Đang convert: ${store.progress.currentFile.split(/[\\/]/).pop()}` : "Sẵn sàng hoạt động"}
              </div>
            </div>
            
            {/* Logs */}
            <div className="flex-1 bg-background/60 rounded-xl border border-border p-2.5 flex flex-col overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar space-y-1">
                {store.logs.map((log, i) => (
                  <div key={i} className="text-[10px] font-mono text-muted-foreground break-all leading-relaxed">
                    <span className="text-primary/70 mr-1.5 select-none">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </div>
                ))}
                {store.logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
                    <Zap size={18} className="opacity-30" />
                    <span className="text-[10px]">Nhật ký xử lý sẽ hiển thị tại đây</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Button */}
            <div className="shrink-0">
              <button 
                onClick={handleStartConvert}
                disabled={store.isConverting || store.inputFolders.length === 0}
                className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  store.isConverting 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border' 
                    : store.inputFolders.length === 0
                    ? 'bg-muted text-muted-foreground/40 cursor-not-allowed border border-border'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
                }`}
              >
                {store.isConverting ? (
                  <>Đang xử lý dữ liệu...</>
                ) : (
                  <>
                    <FileDown size={14} /> Bắt đầu chuyển đổi
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
