import { useEffect, useState } from "react";
import { useSettingsStore } from "@/core/stores/useSettingsStore";

export type BrandLogoVariant = "logo" | "icon" | "transparent-icon";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
  forceTheme?: "light" | "dark";
}

/**
 * Hook to reactively determine if dark theme is currently active,
 * taking into account:
 * 1. App user preference ('dark', 'light', 'system')
 * 2. macOS / OS system prefers-color-scheme
 * 3. HTML 'dark' class on <html> element
 */
export function useIsDarkMode(forceTheme?: "light" | "dark"): boolean {
  const theme = useSettingsStore((s) => s.settings.theme);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (forceTheme) return forceTheme === "dark";
    if (typeof window === "undefined") return true;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return (
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    if (forceTheme) {
      setIsDark(forceTheme === "dark");
      return;
    }

    const checkDark = () => {
      if (theme === "dark") {
        setIsDark(true);
      } else if (theme === "light") {
        setIsDark(false);
      } else {
        // system / auto
        const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const htmlDark = document.documentElement.classList.contains("dark");
        setIsDark(htmlDark || sysDark);
      }
    };

    checkDark();

    // Listen to OS system theme changes
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const mediaListener = () => checkDark();
    media.addEventListener("change", mediaListener);

    // Observer for class mutations on documentElement (e.g. toggle theme instantly)
    const observer = new MutationObserver(() => checkDark());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      media.removeEventListener("change", mediaListener);
      observer.disconnect();
    };
  }, [theme, forceTheme]);

  return isDark;
}

export function BrandLogo({
  variant = "logo",
  className = "h-7 w-auto object-contain",
  alt = "DH Studio Pro",
  forceTheme,
}: BrandLogoProps) {
  const isDark = useIsDarkMode(forceTheme);

  let src = "";
  if (variant === "logo" || variant === "icon") {
    // Squircle app icon: Dark squircle for dark mode, Light squircle for light mode
    src = isDark
      ? "/brand/dh_app_icon_dark_squircle.png"
      : "/brand/dh_app_icon_light_squircle.png";
  } else if (variant === "transparent-icon") {
    // Transparent icon
    src = isDark
      ? "/brand/dh_app_icon_white_transparent.png"
      : "/brand/dh_app_icon_transparent.png";
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`transition-opacity duration-200 select-none ${className}`}
      draggable={false}
      onError={(e) => {
        // Fallback to /logo.png if brand folder file not found
        const target = e.currentTarget;
        if (!target.src.endsWith("/logo.png")) {
          target.src = "/logo.png";
        }
      }}
    />
  );
}
