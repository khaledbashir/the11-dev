"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Check, Loader2, ChevronRight } from "lucide-react";

interface ProgressStep {
  id: number;
  label: string;
  completed: boolean;
  loading: boolean;
}

interface WorkspaceCreationProgressProps {
  isOpen: boolean;
  workspaceName: string;
  currentStep?: number; // 0-3 (which step is currently being processed)
  completedSteps?: number[]; // Array of completed step indices
}

export default function WorkspaceCreationProgress({
  isOpen,
  workspaceName,
  currentStep = 0,
  completedSteps = [],
}: WorkspaceCreationProgressProps) {
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: 0, label: "Creating workspace in AnythingLLM", completed: false, loading: false },
    { id: 1, label: "Saving workspace to database", completed: false, loading: false },
    { id: 2, label: "Creating AI assistant thread", completed: false, loading: false },
    { id: 3, label: "Embedding knowledge base", completed: false, loading: false },
  ]);

  // Update steps based on props
  useEffect(() => {
    setSteps(prevSteps =>
      prevSteps.map(step => ({
        ...step,
        completed: completedSteps.includes(step.id),
        loading: step.id === currentStep,
      }))
    );
  }, [currentStep, completedSteps]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md border border-emerald-500/20 rounded-xl shadow-2xl" style={{ backgroundColor: '#0E0F0F' }} onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Logo Section */}
        <div className="flex justify-center mb-4">
          <img
            src="/images/logo-light.png"
            alt="Social Garden"
            className="h-10 w-auto"
            onError={(e) => {
              // Fallback if image fails to load
              (e.target as any).style.display = 'none';
            }}
          />
        </div>

        <DialogHeader className="border-b border-emerald-500/10 pb-4">
          <DialogTitle className="text-2xl font-bold text-white">
            Setting Up {workspaceName}
          </DialogTitle>
          <p className="text-sm text-gray-300 mt-2 font-light">
            Creating your workspace and AI setup...
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6 px-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4 p-2 rounded-lg transition-colors hover:bg-emerald-500/5">
              {/* Status Icon */}
              <div className="pt-1">
                {step.completed ? (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : step.loading ? (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/30 border border-emerald-500/60 animate-pulse">
                    <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700/50 border border-slate-600/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  </div>
                )}
              </div>

              {/* Step Label */}
              <div className="flex-1 pt-1">
                <p
                  className={`text-sm font-medium transition-colors ${
                    step.completed
                      ? "text-emerald-400"
                      : step.loading
                        ? "text-white font-semibold"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>
                {step.loading && (
                  <p className="text-xs text-gray-300 mt-1 italic">
                    {index === 0 && "🔗 Connecting to AnythingLLM..."}
                    {index === 1 && "💾 Storing workspace details..."}
                    {index === 2 && "💬 Setting up chat thread..."}
                    {index === 3 && "📚 Embedding your knowledge base..."}
                  </p>
                )}
                {step.completed && (
                  <p className="text-xs text-emerald-400/80 mt-1">✓ Complete</p>
                )}
              </div>

              {/* Arrow for active step */}
              {step.loading && (
                <ChevronRight className="w-4 h-4 text-emerald-400 mt-1 animate-bounce" />
              )}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="px-0 pb-4">
          <div className="flex gap-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  step.completed
                    ? "bg-gradient-to-r from-emerald-500 to-green-400"
                    : step.loading
                      ? "bg-gradient-to-r from-emerald-400/60 to-green-300/60 animate-pulse"
                      : "bg-slate-700/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer message */}
        <p className="text-xs text-gray-400 text-center pb-2 font-light">
          🌱 This usually takes 30-60 seconds...
        </p>
      </DialogContent>
    </Dialog>
  );
}
