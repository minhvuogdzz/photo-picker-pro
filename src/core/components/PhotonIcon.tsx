import photonIconUrl from "@/assets/photon-icon.png";

interface PhotonIconProps {
  size?: number | string;
  className?: string;
}

export function PhotonIcon({ size = 16, className = "" }: PhotonIconProps) {
  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <div 
      style={{ width: dimension, height: dimension }} 
      className={`inline-flex items-center justify-center relative select-none pointer-events-none ${className}`}
    >
      <img
        src={photonIconUrl}
        alt="MVD Generation"
        className="w-full h-full object-contain rounded-xs drop-shadow-xs"
        draggable={false}
      />
    </div>
  );
}
