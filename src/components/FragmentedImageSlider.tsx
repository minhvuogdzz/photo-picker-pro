import React, { useState, useEffect } from 'react';

const IMAGES = [
  '/image/2.jpg',
  '/image/3L3A9392.jpg',
  '/image/3L3A9417.jpg',
  '/image/3L3A9504.jpg',
  '/image/3L3A9514.jpg',
  '/image/IMG_0369.jpg',
  '/image/IMG_0373.jpg',
  '/image/IMG_0379.jpg',
  '/image/IMG_0609.jpg',
  '/image/IMG_0987.jpg',
  '/image/IMG_1401.jpg',
  '/image/IMG_5076.jpg',
  '/image/IMG_5088.jpg',
  '/image/MVD_21811.jpg',
  '/image/MVD_21864.jpg',
  '/image/MVD_21869.jpg',
  '/image/d.jpg',
  '/image/e.jpg'
];

export function FragmentedImageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Preload images ngầm để tránh trình duyệt bị khựng khi decode ảnh nặng
  useEffect(() => {
    IMAGES.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Chuyển ảnh mỗi 4 giây
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
    }, 4000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black/20">
      {IMAGES.map((src, index) => {
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
                ? 'opacity 1.2s ease-out, transform 4.5s linear' // Khi hiện: Fade in mượt mà, scale từ từ
                : 'opacity 1.2s ease-in-out, transform 1.2s ease-in-out', // Khi ẩn: Fade out nhanh hơn
              zIndex: isActive ? 10 : 0,
              willChange: isActive ? 'transform, opacity' : 'auto', // Chỉ ép GPU xử lý layer đang chạy
            }}
            alt=""
          />
        );
      })}
    </div>
  );
}
