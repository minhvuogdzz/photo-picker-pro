import React from "react";

interface CoffeeSteamIconProps {
  size?: number;
  className?: string;
  steamColor?: string;
}

export function CoffeeSteamIcon({
  size = 15,
  className = "",
  steamColor,
}: CoffeeSteamIconProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 overflow-visible ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="overflow-visible"
      >
        {/* Steam wisps rising gracefully above cup rim */}
        <g
          className="coffee-steam-group"
          style={steamColor ? { stroke: steamColor } : undefined}
        >
          {/* Left wisp */}
          <path
            d="M6 7 C5 4.5, 7.5 3, 6.5 0.5"
            className="coffee-steam-wisp steam-wisp-1"
            strokeWidth="1.8"
          />
          {/* Middle wisp */}
          <path
            d="M10 7 C11.5 4.5, 9.5 3, 10.5 0"
            className="coffee-steam-wisp steam-wisp-2"
            strokeWidth="1.8"
          />
          {/* Right wisp */}
          <path
            d="M14 7 C13 4.5, 15.5 3, 14.5 0.5"
            className="coffee-steam-wisp steam-wisp-3"
            strokeWidth="1.8"
          />
        </g>

        {/* Cup Handle */}
        <path d="M17 9h1a3.5 3.5 0 0 1 0 7h-1" />
        {/* Cup Body */}
        <path d="M4 9h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
        {/* Saucer */}
        <line x1="2" x2="19" y1="21" y2="21" strokeWidth="1.8" />
      </svg>
    </span>
  );
}
