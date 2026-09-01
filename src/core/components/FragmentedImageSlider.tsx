import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/core/services/apiClient';

export function FragmentedImageSlider() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch dynamic showcase images from Cloudinary backend & Poll every 3s for realtime Admin sync
  useEffect(() => {
    let isMounted = true;

    const fetchShowcase = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/showcase`);
        if (!res.ok) return;
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data) && isMounted) {
          const activeUrls = json.data
            .map((item: { url: string }) => item.url)
            .filter(Boolean);
          
          setImages(activeUrls);
        }
      } catch {
        // Silently handle offline
      }
    };

    fetchShowcase();
    // Tự động làm mới sau mỗi 15 phút (thay vì 3 giây) để tiết kiệm tài nguyên mạng và server
    const interval = setInterval(fetchShowcase, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Điều chỉnh index nếu danh sách ảnh thay đổi
  useEffect(() => {
    if (currentIndex >= images.length && images.length > 0) {
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
