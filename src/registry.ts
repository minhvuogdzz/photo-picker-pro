import { ElementType } from "react";
import { FileImage, Layers, Sparkles, FolderArchive, Palette, FileSpreadsheet } from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";
import { PhotonIcon } from "@/core/components/PhotonIcon";

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
  isPremium?: boolean;
  accentColor: {
    primary: string;
    border: string;
    bgGlow: string;
    iconBg: string;
    badgeClass: string;
    lightGlow: string;
  };
}

export const modules: AppModule[] = [
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
    badge: "Core Studio",
    accentColor: {
      primary: "text-blue-600 dark:text-blue-400",
      border: "hover:border-blue-500/50",
      bgGlow: "from-blue-500/15 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/12 dark:bg-blue-500/25 border-blue-500/25 dark:border-blue-500/35 text-blue-600 dark:text-blue-400",
      badgeClass: "bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25 dark:border-blue-500/35",
      lightGlow: "rgba(59, 130, 246, 0.2)",
    }
  },
  {
    id: "contact-the-sheet",
    name: "Contact the Sheet",
    shortName: "Contact Sheet",
    icon: FileSpreadsheet,
    path: "/contact-the-sheet",
    description: "Tự động hóa đối soát Google Sheet & Google Drive, nhận diện job khách hàng, bảo vệ công thức và cập nhật link trả ảnh hàng loạt.",
    category: "workflow",
    tags: [
      "contact the sheet", "google sheet", "google drive", "đối soát", 
      "link edit", "tên edit", "tự động hóa", "studio", "workflow"
    ],
    badge: "Studio Ops",
    isPremium: true,
    accentColor: {
      primary: "text-emerald-600 dark:text-emerald-400",
      border: "hover:border-emerald-500/50",
      bgGlow: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/12 dark:bg-emerald-500/25 border-emerald-500/25 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400",
      badgeClass: "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 dark:border-emerald-500/35",
      lightGlow: "rgba(16, 185, 129, 0.2)",
    }
  },
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
    isPremium: true,
    accentColor: {
      primary: "text-amber-600 dark:text-amber-400",
      border: "hover:border-amber-500/50",
      bgGlow: "from-amber-500/15 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/12 dark:bg-amber-500/25 border-amber-500/25 dark:border-amber-500/35 text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25 dark:border-amber-500/35",
      lightGlow: "rgba(245, 158, 11, 0.2)",
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
    badge: "Fast Engine",
    accentColor: {
      primary: "text-violet-600 dark:text-violet-400",
      border: "hover:border-violet-500/50",
      bgGlow: "from-violet-500/15 via-violet-500/5 to-transparent",
      iconBg: "bg-violet-500/12 dark:bg-violet-500/25 border-violet-500/25 dark:border-violet-500/35 text-violet-600 dark:text-violet-400",
      badgeClass: "bg-violet-500/10 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25 dark:border-violet-500/35",
      lightGlow: "rgba(139, 92, 246, 0.2)",
    }
  },
  {
    id: "photon-studio",
    name: "MVD Generation",
    shortName: "MVD Gen",
    icon: PhotonIcon,
    path: "/photon-studio",
    description: "Bộ công cụ thế hệ mới MVD Generation gia tốc Metal GPU (Native Swift), xử lý layers, curves, mask và liên thông dữ liệu trực tiếp trong Super-App.",
    category: "retouch",
    tags: [
      "mvd generation", "generation", "mvd studio", "metal", 
      "hậu kỳ", "photoshop", "màu sắc", "mvd"
    ],
    badge: "Native Metal 33MB",
    isPremium: true,
    accentColor: {
      primary: "text-cyan-600 dark:text-cyan-400",
      border: "hover:border-cyan-500/50",
      bgGlow: "from-cyan-500/15 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/12 dark:bg-cyan-500/25 border-cyan-500/25 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400",
      badgeClass: "bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25 dark:border-cyan-500/35",
      lightGlow: "rgba(6, 182, 212, 0.2)",
    }
  }
];

