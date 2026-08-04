import { Image, Search, LucideProps } from "lucide-react";

export const PhotoPickerIcon = (props: LucideProps) => {
  return (
    <div style={{ width: props.size, height: props.size }} className={`relative ${props.className || ''}`}>
      <Image size={props.size} strokeWidth={1.5} />
      <div className="absolute -bottom-1 -right-1 rounded-full p-[2px] bg-background/80 backdrop-blur-md shadow-sm border border-border">
        <Search size={Number(props.size) * 0.5} strokeWidth={3} className="text-primary" />
      </div>
    </div>
  );
};
