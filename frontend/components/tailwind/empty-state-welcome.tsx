"use client";

import { Button } from "./ui/button";
import { FileText, Sparkles } from "lucide-react";

interface EmptyStateWelcomeProps {
  onCreateNewSOW: () => void;
  isLoading?: boolean;
}

export function EmptyStateWelcome({ onCreateNewSOW, isLoading = false }: EmptyStateWelcomeProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0e0f0f]">
      <div className="text-center space-y-8 max-w-md px-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-[#20e28f]/20 rounded-full">
            <FileText className="w-16 h-16 text-[#20e28f]" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">
            Statement of Work Assistant
          </h1>
          <p className="text-lg text-gray-400">
            Create and manage your project documents with AI help
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 text-left bg-[#1b1b1e] border border-[#0e2e33] rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#20e28f] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              <strong>AI-Powered Generation</strong> - Let The Architect AI generate comprehensive SOWs
            </p>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[#20e28f] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              <strong>Organize & Collaborate</strong> - Create folders and manage multiple documents
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#20e28f] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              <strong>Real-time Chat</strong> - Discuss and refine your SOW with AI in a side-by-side view
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onCreateNewSOW}
          disabled={isLoading}
          className="w-full bg-[#20e28f] hover:bg-[#1db876] text-black py-3 text-lg font-semibold rounded-lg transition-all"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              + Create New SOW
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-xs text-gray-500">
          💡 Tip: Use folders to organize documents by client or project
        </p>
      </div>
    </div>
  );
}
