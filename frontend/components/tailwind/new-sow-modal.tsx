"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface NewSOWModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSOW: (name: string) => void;
  workspaceName?: string;
}

export function NewSOWModal({
  isOpen,
  onOpenChange,
  onCreateSOW,
  workspaceName = "Workspace",
}: NewSOWModalProps) {
  const [sowName, setSowName] = useState("");

  const handleCreate = () => {
    if (sowName.trim()) {
      onCreateSOW(sowName);
      setSowName("");
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && sowName.trim()) {
      handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">New Doc</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="e.g., Q3 Marketing Campaign Plan"
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            value={sowName}
            onChange={(e) => setSowName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!sowName.trim()}
              className="bg-[#1CBF79] hover:bg-[#15a366] text-white"
            >
              Create Doc
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
