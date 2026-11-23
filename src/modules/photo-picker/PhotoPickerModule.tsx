import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useTranslation } from "@/core/lib/i18n";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomBar } from "./components/BottomBar";
import { SettingsPage } from "./pages/PhotoPickerSettings";
import { HistoryPage } from "./pages/HistoryPage";
import { MatchProgressPopup } from "./components/MatchProgressPopup";
import { RemoveCompletedCustomerDialog } from "./components/RemoveCompletedCustomerDialog";
import { CrumpledPaperTossAnimation } from "./components/CrumpledPaperTossAnimation";
import { EjectedCustomersModal } from "./components/EjectedCustomersModal";

const DEFAULT_LEFT_WIDTH = 300;
const MIN_LEFT_WIDTH = 210;
const MAX_LEFT_WIDTH = 540;

const DEFAULT_RIGHT_WIDTH = 288;
const MIN_RIGHT_WIDTH = 230;
const MAX_RIGHT_WIDTH = 540;

const MIN_CENTER_WIDTH = 320;

const LEFT_WIDTH_STORAGE_KEY = "mvd_picker_left_panel_width";
const RIGHT_WIDTH_STORAGE_KEY = "mvd_picker_right_panel_width";

function loadStoredWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  } catch {
    return fallback;
  }
}

export function PhotoPickerModule() {
  const activeTab = useAppStore((s) => s.activeTab);
  const { tr } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [leftWidth, setLeftWidth] = useState<number>(() =>
    loadStoredWidth(LEFT_WIDTH_STORAGE_KEY, DEFAULT_LEFT_WIDTH, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH)
  );
  const [rightWidth, setRightWidth] = useState<number>(() =>
    loadStoredWidth(RIGHT_WIDTH_STORAGE_KEY, DEFAULT_RIGHT_WIDTH, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH)
  );
  const [activeResizer, setActiveResizer] = useState<"left" | "right" | null>(null);

  const dragStateRef = useRef<{
    side: "left" | "right";
    startX: number;
    startLeftWidth: number;
    startRightWidth: number;
  } | null>(null);

  const handleStartResize = useCallback(
    (side: "left" | "right", e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (side === "left" && isLeftCollapsed) {
        setIsLeftCollapsed(false);
      }
      dragStateRef.current = {
        side,
        startX: e.clientX,
        startLeftWidth: leftWidth,
        startRightWidth: rightWidth,
      };
      setActiveResizer(side);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isLeftCollapsed, leftWidth, rightWidth]
  );

  useEffect(() => {
    if (!activeResizer) return;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const containerWidth = containerRef.current?.clientWidth ?? 1200;
      const deltaX = e.clientX - drag.startX;

      if (drag.side === "left") {
        const maxAllowedByCenter = Math.max(
          MIN_LEFT_WIDTH,
          containerWidth - drag.startRightWidth - MIN_CENTER_WIDTH - 16
        );
        const upperBound = Math.min(MAX_LEFT_WIDTH, maxAllowedByCenter);
        const nextLeft = Math.round(
          Math.min(upperBound, Math.max(MIN_LEFT_WIDTH, drag.startLeftWidth + deltaX))
        );
        setLeftWidth(nextLeft);
      } else {
        const effectiveLeft = isLeftCollapsed ? 48 : drag.startLeftWidth;
        const maxAllowedByCenter = Math.max(
          MIN_RIGHT_WIDTH,
          containerWidth - effectiveLeft - MIN_CENTER_WIDTH - 16
        );
        const upperBound = Math.min(MAX_RIGHT_WIDTH, maxAllowedByCenter);
        const nextRight = Math.round(
          Math.min(upperBound, Math.max(MIN_RIGHT_WIDTH, drag.startRightWidth - deltaX))
        );
        setRightWidth(nextRight);
      }
    };

    const handlePointerUp = () => {
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      setActiveResizer(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      try {
        if (drag?.side === "left") {
          localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(leftWidth));
        } else if (drag?.side === "right") {
          localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(rightWidth));
        }
      } catch {
        // Ignore storage write errors
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [activeResizer, isLeftCollapsed, leftWidth, rightWidth]);

  const handleResetLeftWidth = useCallback(() => {
    if (isLeftCollapsed) return;
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    try {
      localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(DEFAULT_LEFT_WIDTH));
    } catch {}
  }, [isLeftCollapsed]);

  const handleResetRightWidth = useCallback(() => {
    setRightWidth(DEFAULT_RIGHT_WIDTH);
    try {
      localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(DEFAULT_RIGHT_WIDTH));
    } catch {}
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full gap-2">
      {activeTab === "settings" && (
        <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-sm bg-card">
          <SettingsPage />
        </div>
      )}
      {activeTab === "history" && (
        <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-sm bg-card">
          <HistoryPage />
        </div>
      )}

      {activeTab === "home" && (
        <>
          <div ref={containerRef} className="flex-1 flex min-h-0 min-w-0">
            <LeftPanel
              width={leftWidth}
              isResizing={activeResizer === "left"}
              isCollapsed={isLeftCollapsed}
              onCollapsedChange={setIsLeftCollapsed}
            />

            {/* Left <-> Center Resizer Channel */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={tr("Kéo để thay đổi độ rộng cột trái", "Drag to resize left column")}
              onPointerDown={(e) => handleStartResize("left", e)}
              onDoubleClick={handleResetLeftWidth}
              title={tr(
                "Kéo ngang để chỉnh độ rộng cột trái (nhấp đúp để đặt lại mặc định)",
                "Drag horizontally to resize left column (double-click to reset)"
              )}
              className="w-2 shrink-0 relative flex items-center justify-center select-none cursor-col-resize group"
            >
              <div
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  activeResizer === "left"
                    ? "h-24 bg-primary shadow-[0_0_8px_rgba(58,119,255,0.6)]"
                    : "h-10 bg-transparent group-hover:bg-primary/50"
                }`}
              />
            </div>

            <CenterPanel />

            {/* Center <-> Right Resizer Channel */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={tr("Kéo để thay đổi độ rộng cột phải", "Drag to resize right column")}
              onPointerDown={(e) => handleStartResize("right", e)}
              onDoubleClick={handleResetRightWidth}
              title={tr(
                "Kéo ngang để chỉnh độ rộng cột phải (nhấp đúp để đặt lại mặc định)",
                "Drag horizontally to resize right column (double-click to reset)"
              )}
              className="w-2 shrink-0 relative flex items-center justify-center select-none cursor-col-resize group"
            >
              <div
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  activeResizer === "right"
                    ? "h-24 bg-primary shadow-[0_0_8px_rgba(58,119,255,0.6)]"
                    : "h-10 bg-transparent group-hover:bg-primary/50"
                }`}
              />
            </div>

            <RightPanel width={rightWidth} />
          </div>

          {/* BottomBar Wrapper */}
          <div className="rounded-xl overflow-hidden shadow-sm border border-border shrink-0">
            <BottomBar />
          </div>

          {/* Progress Popup Overlay */}
          <MatchProgressPopup />

          {/* Remove Completed Customer Dialog */}
          <RemoveCompletedCustomerDialog />

          {/* Crumpled Paper Toss Animation Overlay */}
          <CrumpledPaperTossAnimation />

          {/* Ejected Customers Trash Bin Modal */}
          <EjectedCustomersModal />
        </>
      )}
    </div>
  );
}
