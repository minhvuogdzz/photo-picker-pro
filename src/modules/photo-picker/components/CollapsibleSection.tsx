import { useCallback, useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

const STORAGE_PREFIX = "mvd_picker_section_";

/** Open/closed state remembered across app restarts, keyed by a stable id. */
export function usePersistentOpen(id: string, defaultOpen: boolean) {
  const key = `${STORAGE_PREFIX}${id}`;
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultOpen : raw === "1";
    } catch {
      return defaultOpen;
    }
  });

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          localStorage.setItem(key, value ? "1" : "0");
        } catch {
          // storage unavailable: keep in-memory state only
        }
        return value;
      });
    },
    [key]
  );

  return [open, setOpen] as const;
}

interface CollapsibleSectionProps {
  /** Stable id used to remember the open state. */
  readonly id: string;
  readonly title: ReactNode;
  readonly icon?: ReactNode;
  /** Short text shown next to the title while collapsed (e.g. the chosen folder). */
  readonly summary?: ReactNode;
  /** Controls on the right of the header; clicks on them do not toggle the section. */
  readonly actions?: ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function CollapsibleSection({
  id,
  title,
  icon,
  summary,
  actions,
  defaultOpen = true,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = usePersistentOpen(id, defaultOpen);
  const contentId = useId();

  return (
    <section className={`rounded-xl border border-border bg-[#f8f9fb] dark:bg-foreground/[0.025] ${className}`}>
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 min-w-0 items-center gap-2 h-8.5 pl-2.5 text-left rounded-xl hover:bg-foreground/[0.03] transition-colors"
        >
          <ChevronRight
            size={13}
            strokeWidth={2}
            className={`shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          {icon && <span className="shrink-0 text-muted-foreground flex">{icon}</span>}
          <span className="text-[13px] font-semibold text-foreground tracking-tight whitespace-nowrap">{title}</span>
          {!open && summary && (
            <span className="text-xs text-muted-foreground truncate min-w-0">{summary}</span>
          )}
        </button>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
      {open && (
        <div id={contentId} className="px-2.5 pb-2.5 pt-0.5">
          {children}
        </div>
      )}
    </section>
  );
}
