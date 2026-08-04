import { ElementType } from "react";
import { Wand2, Share2 } from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";

export interface AppModule {
  id: string;
  name: string;
  icon: ElementType;
  path: string;
}

export const modules: AppModule[] = [
  {
    id: "photo-picker",
    name: "Photo Picker Pro",
    icon: PhotoPickerIcon,
    path: "/photo-picker",
  },
  {
    id: "retouch",
    name: "Hậu kỳ",
    icon: Wand2,
    path: "/retouch",
  },
  {
    id: "client-gallery",
    name: "Gửi ảnh (Gallery)",
    icon: Share2,
    path: "/client-gallery",
  },
];
