import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className
}) => {
  const pages = [];

  // 生成页码数组
  if (totalPages <= 7) {
    // 如果总页数 <= 7，显示所有页码
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // 总是显示第一页
    pages.push(1);

    if (currentPage <= 3) {
      // 当前页靠前
      pages.push(2, 3, 4);
      pages.push(-1); // 省略号
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      // 当前页靠后
      pages.push(-1); // 省略号
      pages.push(totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      // 当前页在中间
      pages.push(-1); // 省略号
      pages.push(currentPage - 1, currentPage, currentPage + 1);
      pages.push(-2); // 省略号
      pages.push(totalPages);
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((page, index) => {
        if (page < 0) {
          // 省略号
          return (
            <div key={`ellipsis-${index}`} className="h-8 w-8 flex items-center justify-center text-gray-400">
              <MoreHorizontal size={16} />
            </div>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "h-8 min-w-[2rem] px-2 flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
              currentPage === page
                ? "bg-purple-600 text-white"
                : "border border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
