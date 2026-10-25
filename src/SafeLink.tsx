import React from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import type { MainTab } from "@/core/types";

interface SafeLinkProps extends React.HTMLAttributes<HTMLDivElement> {
  to: string; // The module id or tab
  children: React.ReactNode;
}

export function SafeLink({ to, children, className, ...props }: SafeLinkProps) {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const handleClick = () => {
    // For now, we map the "to" destination to the activeTab
    // In the future, this could be a proper router push
    if (to === "settings" || to === "history" || to === "about") {
      setActiveTab(to as MainTab);
    } else {
      // Assuming modules use the 'home' tab for their main interface
      // We would extend this logic when we have real multiple modules
      setActiveTab("home");
    }
  };

  // Exposed as a link so it is reachable by keyboard; Enter / Space run the same click handler.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
