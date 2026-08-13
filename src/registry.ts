import { ElementType } from "react";
import { Wand2, Share2, FileImage, Eraser } from "lucide-react";
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
    id: "mvd-convert",
    name: "MVD Convert",
    icon: FileImage,
    path: "/mvd-convert",
  },
  {
    id: "ps-plugin",
    name: "Cleanup Agent",
    icon: Eraser,
    path: "/ps-plugin",
  },
];
