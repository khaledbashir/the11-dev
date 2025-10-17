"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ResizableLayoutProps {
  leftPanel: React.ReactNode;
  mainPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  leftMinSize?: number;
  mainMinSize?: number;
  rightMinSize?: number;
  leftDefaultSize?: number;
  mainDefaultSize?: number;
  rightDefaultSize?: number;
  sidebarOpen?: boolean;
  aiChatOpen?: boolean;
  onToggleSidebar?: () => void;
  onToggleAiChat?: () => void;
}

export function ResizableLayout({
  leftPanel,
  mainPanel,
  rightPanel,
  leftMinSize = 15,
  mainMinSize = 30,
  rightMinSize = 20,
  leftDefaultSize = 20,
  mainDefaultSize = 55,
  rightDefaultSize = 25,
  sidebarOpen = true,
  aiChatOpen = true,
  onToggleSidebar,
  onToggleAiChat,
}: ResizableLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* MAIN FLEX CONTAINER - LEFT | EDITOR | CHAT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - FIXED WIDTH OR 0 */}
        <div 
          className={`h-full overflow-y-auto overflow-x-hidden flex-shrink-0 border-r border-gray-700 transition-all duration-300 ${
            sidebarOpen ? 'w-80' : 'w-0'
          }`}
        >
          {sidebarOpen && leftPanel}
        </div>

        {/* MIDDLE EDITOR - GROWS TO FILL SPACE */}
        <div 
          className={`flex-1 h-full overflow-hidden min-w-0 flex flex-col transition-all duration-300 ${
            aiChatOpen ? 'flex-basis-[65%]' : 'flex-basis-full'
          }`}
          style={{
            flexBasis: aiChatOpen ? '65%' : 'auto'
          }}
        >
          {mainPanel}
        </div>

        {/* RIGHT CHAT PANEL - FIXED WIDTH OR 0 (NOT OVERLAPPING) */}
        <div 
          className={`h-full overflow-hidden flex-shrink-0 border-l border-gray-700 transition-all duration-300 bg-gray-950 ${
            aiChatOpen ? 'w-[35%] min-w-96' : 'w-0'
          }`}
        >
          {aiChatOpen && rightPanel}
        </div>
      </div>
    </div>
  );
}
