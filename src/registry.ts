import { ElementType } from "react";
import { FileImage, Eraser, Layers, Sparkles, FolderArchive, Palette } from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";

export interface AppModule {
  id: string;
  name: string;
  shortName?: string;
  icon: ElementType;
  path: string;
  description: string;
  category: "retouch" | "workflow" | "resources" | "system";
  tags: string[];
  isPinned?: boolean;
  badge?: string;
  accentColor: {
    primary: string;
    border: string;
    bgGlow: string;
    iconBg: string;
  };
}

export const modules: AppModule[] = [
  {
    id: "resources",
    name: "Kho Tài Nguyên Creative",
    shortName: "Tài nguyên",
    icon: Layers,
    path: "/resources",
    description: "Kho tàng tài nguyên tuyển chọn dành cho Photographer & Retoucher: Presets Lightroom, Actions Photoshop, Brushes, LUTs màu và tài liệu chuyên sâu.",
    category: "resources",
    tags: [
      "tài nguyên", "presets", "actions", "brushes", "luts", 
      "photoshop", "lightroom", "overlay", "texture", "tài liệu", 
      "giáo trình", "retouch", "blend màu"
    ],
    isPinned: true,
    badge: "Featured Hub",
    accentColor: {
      primary: "text-amber-400",
      border: "hover:border-amber-400/50 hover:shadow-[0_0_30px_rgba(251,191,36,0.3)]",
      bgGlow: "from-amber-500/20 via-orange-500/10 to-transparent",
      iconBg: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
    }
  },
  {
    id: "photo-picker",
    name: "Photo Picker Pro",
    shortName: "Lọc ảnh",
    icon: PhotoPickerIcon,
    path: "/photo-picker",
    description: "Phần mềm lọc ảnh tự động, đồng nhất tên các thư mục, quét mã khách hàng và tích hợp Google Sheet siêu tốc.",
    category: "workflow",
    tags: [
      "lọc ảnh", "photo picker", "đồng bộ", "google sheet", 
      "khách hàng", "copy ảnh", "studio", "raw", "chọn ảnh"
    ],
    badge: "Core App",
    accentColor: {
      primary: "text-blue-400",
      border: "hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]",
      bgGlow: "from-blue-500/20 via-cyan-500/10 to-transparent",
      iconBg: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
    }
  },
  {
    id: "mvd-convert",
    name: "MVD Convert",
    shortName: "Convert",
    icon: FileImage,
    path: "/mvd-convert",
    description: "Chuyển đổi đa luồng định dạng ảnh hàng loạt từ RAW (CR2, CR3, NEF, ARW) sang JPG/PNG/WebP chất lượng cao.",
    category: "workflow",
    tags: [
      "convert", "chuyển đổi", "raw sang jpg", "cr2", "cr3", 
      "nef", "arw", "webp", "nén ảnh", "batch convert"
    ],
    badge: "Fast engine",
    accentColor: {
      primary: "text-emerald-400",
      border: "hover:border-emerald-400/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]",
      bgGlow: "from-emerald-500/20 via-teal-500/10 to-transparent",
      iconBg: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
    }
  },
  {
    id: "ps-plugin",
    name: "Cleanup Agent",
    shortName: "Retouch Agent",
    icon: Eraser,
    path: "/ps-plugin",
    description: "Tự động hóa tác vụ nhận diện vùng rác, tạo mask và làm sạch trực tiếp trong Adobe Photoshop qua Content-Aware.",
    category: "retouch",
    tags: [
      "retouch", "photoshop", "cleanup", "xóa rác", "content-aware", 
      "mask", "plugin", "tự động hóa", "brush"
    ],
    badge: "PS Bridge",
    accentColor: {
      primary: "text-purple-400",
      border: "hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.35)]",
      bgGlow: "from-purple-500/20 via-pink-500/10 to-transparent",
      iconBg: "from-purple-500/20 to-pink-500/10 border-purple-500/30",
    }
  },
];
