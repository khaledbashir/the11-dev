"use client";

import { Check, AlertCircle, Loader2, Download, FileSpreadsheet, Share2 } from "lucide-react";
import { Button } from "./ui/button";

interface DocumentStatusBarProps {
  title: string;
  saveStatus: "unsaved" | "saving" | "saved";
  onSave?: () => void;
  isSaving?: boolean;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onSharePortal?: () => void;
}

export function DocumentStatusBar({
  title,
  saveStatus,
  onSave,
  isSaving = false,
  onExportPDF,
  onExportExcel,
  onSharePortal,
}: DocumentStatusBarProps) {
  const statusConfig = {
    unsaved: {
      icon: AlertCircle,
      text: "Unsaved Changes",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
    saving: {
      icon: Loader2,
      text: "Saving...",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    saved: {
      icon: Check,
      text: "All changes saved",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
  };

  const config = statusConfig[saveStatus];
  const IconComponent = config.icon;

  return (
    <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
      {/* Title */}
      <h2 className="text-lg font-semibold text-white truncate">{title}</h2>

      {/* Actions Section */}
      <div className="flex items-center gap-3">
        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              variant="outline"
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
          
          {onExportExcel && (
            <Button
              onClick={onExportExcel}
              variant="outline"
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-600 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          )}
          
          {onSharePortal && (
            <Button
              onClick={onSharePortal}
              variant="outline"
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-600 transition-colors"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Portal
            </Button>
          )}
        </div>

        {/* Separator */}
        {(onExportPDF || onExportExcel || onSharePortal) && (onSave || saveStatus) && (
          <div className="h-6 w-px bg-gray-700"></div>
        )}
        
        {/* Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded ${config.bgColor}`}>
          <IconComponent
            className={`w-4 h-4 ${config.color} ${
              saveStatus === "saving" ? "animate-spin" : ""
            }`}
          />
          <span className={`text-sm font-medium ${config.color}`}>
            {config.text}
          </span>
        </div>

        {/* Save Button */}
        {onSave && (
          <Button
            onClick={onSave}
            disabled={saveStatus === "saved" || isSaving}
            className={`text-white font-semibold transition-all ${
              saveStatus === "saved" || isSaving
                ? 'bg-gray-700 hover:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#1CBF79] hover:bg-[#15a366]'
            }`}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving
              </>
            ) : (
              "Save"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
