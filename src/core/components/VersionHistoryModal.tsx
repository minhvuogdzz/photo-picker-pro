import React, { useState } from 'react';
import { 
  X, 
  History, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Wrench, 
  ShieldCheck, 
  Palette, 
  Zap,
  Tag
} from 'lucide-react';
import { RECENT_7_VERSIONS, VersionReleaseNote, VersionReleaseSection } from '@/core/data/versionHistory';

interface VersionHistoryModalProps {
  onClose: () => void;
  isLatestNotice?: boolean;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ 
  onClose,
  isLatestNotice = false 
}) => {
  // By default, open the first 2 versions, others collapsed for clean overview
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    [RECENT_7_VERSIONS[0].version]: true,
    [RECENT_7_VERSIONS[1].version]: true,
  });

  const toggleVersion = (ver: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [ver]: !prev[ver],
    }));
  };

  const getSectionIcon = (type: VersionReleaseSection['type']) => {
    switch (type) {
      case 'design':
        return <Palette size={14} className="text-purple-500 shrink-0" />;
      case 'feature':
        return <Sparkles size={14} className="text-amber-500 shrink-0" />;
      case 'improvement':
        return <Zap size={14} className="text-emerald-500 shrink-0" />;
      case 'fix':
        return <Wrench size={14} className="text-blue-500 shrink-0" />;
      case 'security':
        return <ShieldCheck size={14} className="text-indigo-500 shrink-0" />;
      default:
        return <CheckCircle2 size={14} className="text-primary shrink-0" />;
    }
  };

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="dlg-version-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card text-foreground rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] border border-border flex flex-col overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="dlg-version-history-title" className="text-base font-bold text-foreground">
                  Lịch sử phiên bản
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                  7 bản gần nhất
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chi tiết cập nhật và ghi chú phát hành (Release Notes)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Đóng"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice banner if user checked for update and is up-to-date */}
        {isLatestNotice && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={18} className="shrink-0" />
            <div>
              <span className="font-bold">Bạn đang sử dụng phiên bản mới nhất ({RECENT_7_VERSIONS[0].version})</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Không có bản cập nhật mới nào tại thời điểm hiện tại.
              </p>
            </div>
          </div>
        )}

        {/* Versions List */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {RECENT_7_VERSIONS.map((item: VersionReleaseNote) => {
            const isExpanded = !!expandedVersions[item.version];

            return (
              <div 
                key={item.version}
                className={`rounded-2xl border transition-all ${
                  item.isCurrent 
                    ? "border-primary/40 bg-primary/[0.03] shadow-sm" 
                    : "border-border/80 bg-card/60 hover:border-border"
                }`}
              >
                {/* Version summary header */}
                <button
                  type="button"
                  onClick={() => toggleVersion(item.version)}
                  className="w-full text-left p-4.5 flex items-start justify-between gap-3 cursor-pointer select-none"
                  aria-expanded={isExpanded}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-foreground/10 text-foreground">
                        {item.version}
                      </span>
                      {item.isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Phiên bản hiện tại
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Tag size={11} /> {item.date}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-foreground">
                      {item.title}
                    </h4>
                  </div>

                  <div className="text-muted-foreground hover:text-foreground p-1 transition-transform">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Collapsible Release Notes Details */}
                {isExpanded && (
                  <div className="px-4.5 pb-4.5 pt-1 border-t border-border/50 space-y-3.5 animate-slide-up">
                    {item.sections.map((sec, secIdx) => (
                      <div key={secIdx} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          {getSectionIcon(sec.type)}
                          <span>{sec.title}</span>
                        </div>
                        <ul className="space-y-1 pl-5 list-disc text-xs text-muted-foreground leading-relaxed">
                          {sec.items.map((bullet, bIdx) => (
                            <li key={bIdx} className="pl-0.5">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
          <span>Tổng cộng 7 phiên bản gần nhất</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer shadow-sm active:scale-97"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
