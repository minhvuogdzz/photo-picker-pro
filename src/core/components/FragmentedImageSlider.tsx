import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/core/services/apiClient';

// Module-level cache to provide instantaneous rendering and throttle requests across mounts
let cachedShowcaseImages: string[] = [];
let lastShowcaseFetchTime = 0;
const SHOWCASE_FOCUS_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown between focus revalidations
const SHOWCASE_POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes periodic revalidation while on login screen
const CACHE_STORAGE_KEY = 'photo_picker_showcase_cache_v1';
const CACHE_TIME_KEY = 'photo_picker_showcase_time_v1';

// Pre-load from sessionStorage on module load
try {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem(CACHE_STORAGE_KEY);
    const savedTime = sessionStorage.getItem(CACHE_TIME_KEY);
    if (saved && savedTime) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedShowcaseImages = parsed;
        lastShowcaseFetchTime = Number(savedTime) || 0;
      }
    }
  }
} catch {
  // Ignore storage errors
}

export function FragmentedImageSlider() {
  const [images, setImages] = useState<string[]>(() => cachedShowcaseImages);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Fetch dynamic showcase images from backend with relaxed cooldowns
  const fetchShowcase = useCallback(async (isForced: boolean = false) => {
    // Inflight deduplication: don't start a duplicate fetch if one is already running
    if (isFetchingRef.current) return;

    // Cooldown check for automatic/event-based fetches
    const now = Date.now();
    if (!isForced && lastShowcaseFetchTime > 0 && now - lastShowcaseFetchTime < SHOWCASE_FOCUS_COOLDOWN_MS) {
      return;
    }

    isFetchingRef.current = true;
    try {
      const res = await fetch(`${API_BASE_URL}/showcase`);
      if (!res.ok) return;

      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        lastShowcaseFetchTime = Date.now();
        const activeUrls: string[] = json.data
          .map((item: { url: string }) => item.url)
          .filter(Boolean);

        cachedShowcaseImages = activeUrls;
        try {
          sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(activeUrls));
          sessionStorage.setItem(CACHE_TIME_KEY, String(lastShowcaseFetchTime));
        } catch {
          // Ignore storage quota
        }

        if (isMountedRef.current) {
          setImages((prev) => {
            if (
              prev.length === activeUrls.length &&
              prev.every((u, i) => u === activeUrls[i])
            ) {
              return prev;
            }
            return activeUrls;
          });
        }
      }
    } catch {
      // Silently handle offline; cached images will remain visible
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch on mount and periodic sync (30m)
  useEffect(() => {
    isMountedRef.current = true;

    // Fetch on initial mount only if cache is empty or older than 15 minutes
    if (cachedShowcaseImages.length === 0 || Date.now() - lastShowcaseFetchTime > SHOWCASE_FOCUS_COOLDOWN_MS) {
      fetchShowcase(true);
    }

    let focusDebounceTimer: NodeJS.Timeout | null = null;
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') return;

      // Debounce focus and visibilitychange (which fire simultaneously on window focus)
      if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
      focusDebounceTimer = setTimeout(() => {
        if (isMountedRef.current && document.visibilityState === 'visible') {
          fetchShowcase(false);
        }
      }, 300);
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Periodic sync: 15 minutes instead of 60 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchShowcase(true);
      }
    }, SHOWCASE_POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [fetchShowcase]);

  // Điều chỉnh index nếu danh sách ảnh thay đổi
  useEffect(() => {
    if (images.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= images.length) {
      setCurrentIndex(0);
    }
  }, [images.length, currentIndex]);

  // Preload images ngầm để tránh giật lag khi chuyển slide
  useEffect(() => {
    images.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  // Chuyển ảnh mỗi 4 giây
  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000); 

    return () => clearInterval(interval);
  }, [images.length]);

  // Nếu chưa có ảnh nào hoặc Admin ẩn toàn bộ ảnh trong album
  if (images.length === 0) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-slate-950 via-zinc-900 to-black flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08),transparent_70%)]" />
        <div className="text-center px-6 z-10 opacity-30 select-none">
          <div className="w-12 h-12 rounded-full border border-white/20 mx-auto mb-3 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
          <p className="text-xs tracking-widest uppercase text-white/60">Photo Picker Pro</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black/20">
      {images.map((src, index) => {
        const isActive = index === currentIndex;
        
        return (
          <img 
            key={src}
            src={src}
            className="absolute inset-0 w-full h-full object-cover max-w-none origin-center"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              transition: isActive 
                ? 'opacity 1.2s ease-out, transform 4.5s linear'
                : 'opacity 1.2s ease-in-out, transform 1.2s ease-in-out',
              zIndex: isActive ? 10 : 0,
              willChange: isActive ? 'transform, opacity' : 'auto',
            }}
            alt=""
          />
        );
      })}
    </div>
  );
}
