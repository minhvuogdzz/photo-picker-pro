import { ElementType } from "react";
import { FileImage, Layers, FileSpreadsheet, BarChart3 } from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";
import type { Language } from "@/core/lib/i18n";

export interface AppModule {
  id: string;
  name: string;
  nameEn: string;
  shortName?: string;
  shortNameEn?: string;
  icon: ElementType;
  path: string;
  description: string;
  descriptionEn: string;
  category: "retouch" | "workflow" | "resources" | "system";
  tags: string[];
  isPinned?: boolean;
  badge?: string;
  accentColor: {
    primary: string;
    border: string;
    bgGlow: string;
    iconBg: string;
    badgeClass: string;
    lightGlow: string;
  };
}

export function getLocalizedModule(mod: AppModule, lang: Language) {
  const isEn = lang === "en";
  return {
    name: isEn ? mod.nameEn : mod.name,
    shortName: isEn ? (mod.shortNameEn ?? mod.shortName ?? mod.nameEn) : (mod.shortName ?? mod.name),
    description: isEn ? mod.descriptionEn : mod.description,
  };
}

export const modules: AppModule[] = [
  {
    id: "photo-picker",
    name: "Photo Picker Pro",
    nameEn: "Photo Picker Pro",
    shortName: "Lọc ảnh",
    shortNameEn: "Photo Picker",
    icon: PhotoPickerIcon,
    path: "/photo-picker",
    description: "Phần mềm lọc ảnh tự động, đồng nhất tên các thư mục, quét mã khách hàng và tích hợp Google Sheet siêu tốc.",
    descriptionEn: "Automated photo culling software with smart folder normalization, customer code scanning, and high-speed Google Sheets integration.",
    category: "workflow",
    tags: [
      "lọc ảnh", "photo picker", "đồng bộ", "google sheet",
      "khách hàng", "copy ảnh", "studio", "raw", "chọn ảnh",
      "cull", "filter", "sync", "customer", "select", "copy photos"
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
    nameEn: "Contact the Sheet",
    shortName: "Contact Sheet",
    shortNameEn: "Contact Sheet",
    icon: FileSpreadsheet,
    path: "/contact-the-sheet",
    description: "Tự động hóa đối soát Google Sheet & Google Drive, nhận diện job khách hàng, bảo vệ công thức và cập nhật link trả ảnh hàng loạt.",
    descriptionEn: "Automate Google Sheets & Google Drive reconciliation, match client jobs, protect sheet formulas, and batch-update delivery links.",
    category: "workflow",
    tags: [
      "contact the sheet", "google sheet", "google drive", "đối soát",
      "link edit", "tên edit", "tự động hóa", "studio", "workflow",
      "reconcile", "automation", "batch", "delivery link"
    ],
    badge: "Workflow",
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
    nameEn: "Creative Resources Hub",
    shortName: "Tài nguyên",
    shortNameEn: "Resources",
    icon: Layers,
    path: "/resources",
    description: "Kho tàng tài nguyên tuyển chọn dành cho Photographer & Retoucher: Presets Lightroom, Actions Photoshop, Brushes, LUTs màu và tài liệu chuyên sâu.",
    descriptionEn: "Curated creative library for Photographers & Retouchers: Lightroom Presets, Photoshop Actions, Brushes, Color LUTs, and pro guides.",
    category: "resources",
    tags: [
      "tài nguyên", "presets", "actions", "brushes", "luts",
      "photoshop", "lightroom", "overlay", "texture", "tài liệu",
      "giáo trình", "retouch", "blend màu",
      "resources", "creative", "color grading", "guide"
    ],
    isPinned: true,
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
    name: "Chuyển đổi file",
    nameEn: "File Converter",
    shortName: "Convert file",
    shortNameEn: "File Converter",
    icon: FileImage,
    path: "/mvd-convert",
    description: "Chuyển đổi đa luồng định dạng ảnh hàng loạt từ RAW (CR2, CR3, NEF, ARW) sang JPG/PNG/WebP chất lượng cao.",
    descriptionEn: "High-speed multi-threaded batch image converter from RAW (CR2, CR3, NEF, ARW) to JPG/PNG/WebP with batch EXIF date correction.",
    category: "workflow",
    tags: [
      "convert", "chuyển đổi", "raw sang jpg", "cr2", "cr3",
      "nef", "arw", "webp", "nén ảnh", "batch convert",
      "exif", "date correction", "compress"
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
    id: "photo-counter",
    name: "Thống kê",
    nameEn: "Photo Analytics",
    shortName: "Thống kê",
    shortNameEn: "Analytics",
    icon: BarChart3,
    path: "/photo-counter",
    description: "Thống kê sản lượng ảnh hoàn thiện theo ngày, bóc tách thư mục sâu nhất, phân loại ảnh và đối soát hiệu suất studio.",
    descriptionEn: "Daily finished-photo production analytics, deepest-folder extraction, image classification, and studio throughput tracking.",
    category: "workflow",
    tags: [
      "thống kê", "sản lượng", "kpi", "đếm ảnh", "tiến độ",
      "retouch", "thư mục sâu nhất", "studio", "thang",
      "analytics", "statistics", "counter", "salary", "throughput"
    ],
    badge: "Analytics",
    accentColor: {
      primary: "text-emerald-600 dark:text-emerald-400",
      border: "hover:border-emerald-500/50",
      bgGlow: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/12 dark:bg-emerald-500/25 border-emerald-500/25 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400",
      badgeClass: "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 dark:border-emerald-500/35",
      lightGlow: "rgba(16, 185, 129, 0.2)",
    }
  }
];
