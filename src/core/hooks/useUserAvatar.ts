import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/useAuthStore";

export function useUserAvatar() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.userId || "default_user";
  const storageKey = `dh_studio_user_avatar_${userId}`;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(storageKey);
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      setAvatarUrl(saved);
    }
  }, [storageKey]);

  // Listen to cross-window storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setAvatarUrl(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  // Listen to same-window custom events
  useEffect(() => {
    const handleCustomUpdate = () => {
      const saved = localStorage.getItem(storageKey);
      setAvatarUrl(saved);
    };
    window.addEventListener("dh_avatar_updated", handleCustomUpdate);
    return () => window.removeEventListener("dh_avatar_updated", handleCustomUpdate);
  }, [storageKey]);

  const updateAvatar = useCallback(
    (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Không thể khởi tạo canvas"));
              return;
            }

            // Center-crop to square
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;

            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const base64 = canvas.toDataURL("image/jpeg", 0.88);

            try {
              localStorage.setItem(storageKey, base64);
              setAvatarUrl(base64);
              window.dispatchEvent(new Event("dh_avatar_updated"));
              resolve(base64);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Không thể đọc ảnh"));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc tệp"));
        reader.readAsDataURL(file);
      });
    },
    [storageKey]
  );

  const removeAvatar = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setAvatarUrl(null);
      window.dispatchEvent(new Event("dh_avatar_updated"));
    } catch {}
  }, [storageKey]);

  return {
    avatarUrl,
    updateAvatar,
    removeAvatar,
  };
}
