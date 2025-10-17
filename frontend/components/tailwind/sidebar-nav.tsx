"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { NewSOWModal } from "./new-sow-modal";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Edit3,
  LayoutDashboard,
  Sparkles,
  ChevronLeft,
} from "lucide-react";

interface SOW {
  id: string;
  name: string;
  workspaceId: string;
}

interface Workspace {
  id: string;
  name: string;
  sows: SOW[];
}

interface SidebarNavProps {
  currentView: "dashboard" | "gardner-studio" | "editor";
  onViewChange: (view: "dashboard" | "gardner-studio" | "editor") => void;
  
  workspaces: Workspace[];
  currentWorkspaceId: string;
  currentSOWId: string | null;
  
  onSelectWorkspace: (id: string) => void;
  onSelectSOW: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onCreateSOW: (workspaceId: string, name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onRenameSOW: (id: string, title: string) => void;
  onDeleteSOW: (id: string) => void;
  onToggleSidebar?: () => void;
}

export default function SidebarNav({
  currentView,
  onViewChange,
  workspaces,
  currentWorkspaceId,
  currentSOWId,
  onSelectWorkspace,
  onSelectSOW,
  onCreateWorkspace,
  onCreateSOW,
  onRenameWorkspace,
  onDeleteWorkspace,
  onRenameSOW,
  onDeleteSOW,
  onToggleSidebar,
}: SidebarNavProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    new Set(workspaces.map(w => w.id))
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showNewSOWModal, setShowNewSOWModal] = useState(false);
  const [newSOWWorkspaceId, setNewSOWWorkspaceId] = useState<string | null>(null);

  const toggleWorkspace = (id: string) => {
    const newExpanded = new Set(expandedWorkspaces);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWorkspaces(newExpanded);
  };

  const handleRename = (id: string, isWorkspace: boolean) => {
    if (renameValue.trim()) {
      if (isWorkspace) {
        onRenameWorkspace(id, renameValue);
      } else {
        onRenameSOW(id, renameValue);
      }
      setRenamingId(null);
      setRenameValue("");
    }
  };

  return (
    <div className="w-64 h-full bg-[#0E0F0F] border-r border-gray-800 flex flex-col relative">
      {/* COLLAPSE BUTTON - Top Right Corner */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="absolute top-4 right-4 p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-gray-300 z-10"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* STATIC LINKS SECTION */}
      <div className="flex-shrink-0 p-4 space-y-2 border-b border-gray-800">
        {/* Dashboard Link */}
        <button
          onClick={() => onViewChange("dashboard")}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
            currentView === "dashboard"
              ? "bg-[#0e2e33] text-white"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-900/50"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Dashboard</span>
        </button>

        {/* Gardner Studio Link */}
        <button
          onClick={() => onViewChange("gardner-studio")}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
            currentView === "gardner-studio"
              ? "bg-[#0e2e33] text-white"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-900/50"
          }`}
        >
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Gardner Studio</span>
        </button>
      </div>

      {/* WORKSPACES SECTION */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Workspaces Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Workspaces</h3>
          <div className="flex items-center gap-1">
            <Dialog open={showNewWorkspaceDialog} onOpenChange={setShowNewWorkspaceDialog}>
              <DialogTrigger asChild>
                <button
                  className="p-1 hover:bg-gray-800 rounded transition-colors text-[#1CBF79]"
                  title="New Workspace"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">New Workspace</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Workspace name (e.g., Client A, Project Phoenix)"
                  className="bg-gray-800 border-gray-700 text-white"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newWorkspaceName.trim()) {
                      onCreateWorkspace(newWorkspaceName);
                      setShowNewWorkspaceDialog(false);
                      setNewWorkspaceName("");
                    }
                  }}
                  autoFocus
                />
                <Button
                  onClick={() => {
                    if (newWorkspaceName.trim()) {
                      onCreateWorkspace(newWorkspaceName);
                      setShowNewWorkspaceDialog(false);
                      setNewWorkspaceName("");
                    }
                  }}
                  className="bg-[#1CBF79] hover:bg-[#15a366] text-white"
                >
                  Create Workspace
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Workspaces List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {workspaces.map((workspace) => {
              const isExpanded = expandedWorkspaces.has(workspace.id);

              return (
                <div key={workspace.id}>
                  {/* Workspace Item */}
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800/50 rounded-lg group">
                    {/* Toggle Arrow */}
                    <button
                      onClick={() => toggleWorkspace(workspace.id)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Workspace Name */}
                    <div className="flex-1 min-w-0">
                      {renamingId === workspace.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(workspace.id, true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(workspace.id, true);
                          }}
                          className="h-6 py-0 text-xs bg-gray-800 border-gray-600"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <button
                          onClick={() => onSelectSOW("")}
                          className="w-full text-left px-2 py-1 text-sm text-gray-300 hover:text-white transition-colors"
                        >
                          {workspace.name}
                        </button>
                      )}
                    </div>

                    {/* Action Buttons (visible on hover) */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Add SOW */}
                      <button
                        onClick={() => {
                          setNewSOWWorkspaceId(workspace.id);
                          setShowNewSOWModal(true);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-[#1CBF79] transition-colors"
                        title="New SOW"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      {/* Rename */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(workspace.id);
                          setRenameValue(workspace.name);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-300 transition-colors"
                        title="Rename"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteWorkspace(workspace.id)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* SOWs in Workspace (when expanded) */}
                  {isExpanded && (
                    <div className="ml-6 space-y-0.5">
                      {workspace.sows.map((sow) => (
                        <div
                          key={sow.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded-lg group transition-colors ${
                            currentSOWId === sow.id
                              ? "bg-[#0e2e33] text-white"
                              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
                          }`}
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />

                          {/* SOW Name */}
                          <div className="flex-1 min-w-0">
                            {renamingId === sow.id ? (
                              <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => handleRename(sow.id, false)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRename(sow.id, false);
                                }}
                                className="h-6 py-0 text-xs bg-gray-800 border-gray-600"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <button
                                onClick={() => onSelectSOW(sow.id)}
                                className="w-full text-left text-xs truncate"
                              >
                                {sow.name}
                              </button>
                            )}
                          </div>

                          {/* SOW Actions (visible on hover) */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            {/* Rename */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(sow.id);
                                setRenameValue(sow.name);
                              }}
                              className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-300 transition-colors"
                              title="Rename"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => onDeleteSOW(sow.id)}
                              className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {workspaces.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-600">No workspaces yet</p>
                <p className="text-xs text-gray-700 mt-2">Click the + button to create one</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* New SOW Modal */}
      <NewSOWModal
        isOpen={showNewSOWModal}
        onOpenChange={setShowNewSOWModal}
        onCreateSOW={(name) => {
          if (newSOWWorkspaceId) {
            onCreateSOW(newSOWWorkspaceId, name);
            setShowNewSOWModal(false);
            setNewSOWWorkspaceId(null);
          }
        }}
        workspaceName={workspaces.find(w => w.id === newSOWWorkspaceId)?.name}
      />
    </div>
  );
}
