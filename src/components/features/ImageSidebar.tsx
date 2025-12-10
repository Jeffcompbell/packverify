import React, { useRef } from 'react';
import { ImageItem } from '../../types/types';
import { Plus, Image as ImageIcon, Trash2 } from 'lucide-react';

interface ImageSidebarProps {
    images: ImageItem[];
    selectedImageId: string | null;
    onSelect: (id: string) => void;
    onUpload: (file: File) => void;
    onRemove: (id: string) => void;
}

export const ImageSidebar: React.FC<ImageSidebarProps> = ({
    images,
    selectedImageId,
    onSelect,
    onUpload,
    onRemove
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
            // Reset input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    return (
        <div className="absolute top-20 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 z-50 shadow-2xl transition-all duration-300 max-w-[300px]">
            {/* Grid for Images & Add Button */}
            <div className="grid grid-cols-4 gap-2">
                {images.map((img) => (
                    <div
                        key={img.id}
                        className={`relative group w-10 aspect-[9/16] rounded-md cursor-pointer transition-all duration-200 ${selectedImageId === img.id
                            ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900'
                            : 'hover:ring-1 hover:ring-slate-500'
                            }`}
                        onClick={() => onSelect(img.id)}
                    >
                        <img
                            src={img.src}
                            alt="缩略图"
                            className="w-full h-full object-cover rounded-md bg-slate-800"
                        />

                        {/* Remove Button (Hover) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(img.id);
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-10"
                            title="删除"
                        >
                            <Trash2 size={8} />
                        </button>
                    </div>
                ))}

                {/* Add Button (Small, in grid) */}
                {images.length < 8 && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-10 aspect-[9/16] rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-all"
                        title="添加图片"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />

            {/* Count */}
            {images.length > 0 && (
                <div className="mt-2 text-[9px] text-slate-500 text-center font-medium">
                    {images.length} / 8 张
                </div>
            )}
        </div>
    );
};
