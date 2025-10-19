"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SelectionToolbarProps {
  onAskAI: () => void;
  isVisible: boolean;
}

export function SelectionToolbar({ onAskAI, isVisible }: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Update toolbar position based on selection
  useEffect(() => {
    if (!isVisible || !toolbarRef.current) return;

    const updatePosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position toolbar above the selection, centered
      setPosition({
        top: rect.top + window.scrollY - 60,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-in fade-in duration-200 pointer-events-none"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
    >
      {/* Arrow pointing down to selection */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
        <div className="w-2 h-2 bg-gradient-to-br from-[#1FE18E] to-[#0e2e33] transform rotate-45 shadow-lg"></div>
      </div>

      {/* Main toolbar container */}
      <div className="bg-gradient-to-r from-[#1FE18E]/95 via-white/95 to-[#0e2e33]/95 rounded-xl shadow-2xl border border-[#1FE18E]/40 px-4 py-3 flex items-center gap-3 backdrop-blur-md pointer-events-auto">
        {/* Icon */}
        <div className="text-[#1FE18E] animate-pulse">
          <Sparkles className="h-5 w-5" />
        </div>

        {/* Button */}
        <button
          onClick={onAskAI}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={`
            flex items-center gap-2 px-4 py-2
            font-semibold text-sm
            rounded-lg
            transition-all duration-300
            transform
            ${isHovering ? 'scale-105' : 'scale-100'}
            ${isHovering 
              ? 'bg-[#1FE18E] text-[#0e2e33] shadow-lg' 
              : 'bg-[#1FE18E]/80 text-white shadow-md hover:shadow-lg'
            }
          `}
          title="Ask AI to help with selected text (Press Alt+A)"
        >
          <Sparkles className="h-4 w-4" />
          <span>ASK THE AI</span>
        </button>
      </div>

      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1FE18E]/20 to-transparent blur-lg -z-10 animate-pulse"></div>
    </div>
  );
}
