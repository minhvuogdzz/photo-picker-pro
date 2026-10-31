import { Image, Search } from "lucide-react";

export interface PhotoPickerIconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

export const PhotoPickerIcon = ({
  size = 18,
  className = "",
  strokeWidth = 1.75,
}: PhotoPickerIconProps) => {
  const numSize = typeof size === "number" ? size : parseInt(String(size), 10) || 18;
  const searchSize = Math.max(7, Math.round(numSize * 0.48));

  return (
    <div
      style={{ width: numSize, height: numSize }}
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <Image size={numSize} strokeWidth={strokeWidth} className="w-full h-full text-current" />
      <span className="absolute -bottom-1 -right-1 rounded-full p-[1.5px] bg-background/95 dark:bg-zinc-950/95 shadow-xs border border-border/70 flex items-center justify-center leading-none">
        <Search size={searchSize} strokeWidth={2.8} className="text-current" />
      </span>
    </div>
  );
};
