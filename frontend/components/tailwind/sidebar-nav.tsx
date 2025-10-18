"use client";

import { useState, useEffect } from "react";
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
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SOW {
  id: string;
  name: string;
  workspaceId: string;
}

interface Workspace {
  id: string;
  name: string;
  sows: SOW[];
  workspace_slug?: string;
  slug?: string;
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
  onReorderWorkspaces?: (workspaces: Workspace[]) => void;
  onReorderSOWs?: (workspaceId: string, sows: SOW[]) => void;
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
  onReorderWorkspaces,
  onReorderSOWs,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localWorkspaces, setLocalWorkspaces] = useState(workspaces);
  
  // Category expansion states
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['clients', 'agents', 'system'])
  );

  // Update local workspaces when prop changes
  useEffect(() => {
    setLocalWorkspaces(workspaces);
  }, [workspaces]);

  // Helper functions to categorize workspaces
  const isAgentWorkspace = (workspace: any) => {
    const agentSlugs = [
      'gen-the-architect',
      'property-marketing-pro',
      'ad-copy-machine',
      'crm-communication-specialist',
      'case-study-crafter',
      'landing-page-persuader',
      'seo-content-strategist',
      'proposal-audit-specialist',
      'proposal-and-audit-specialist'
    ];
    const slug = workspace.workspace_slug || workspace.slug;
    const matchBySlug = slug && agentSlugs.includes(slug);
    const matchByName = agentSlugs.some(s => workspace.name.toLowerCase().includes(s.replace(/-/g, ' ')));
    return matchBySlug || matchByName;
  };

  const isSystemWorkspace = (workspace: any) => {
    const systemSlugs = [
      'default-client',
      'sow-master-dashboard',
      'gen',
      'sql',
      'sow-master-dashboard-63003769',
      'pop'
    ];
    const slug = workspace.workspace_slug || workspace.slug;
    const matchBySlug = slug && systemSlugs.includes(slug);
    const matchByName = systemSlugs.some(s => workspace.name.toLowerCase().includes(s.replace(/-/g, ' ')));
    return matchBySlug || matchByName;
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Check if dragging workspace or SOW
    const activeWorkspace = localWorkspaces.find(w => w.id === active.id);
    const overWorkspace = localWorkspaces.find(w => w.id === over.id);

    if (activeWorkspace && overWorkspace) {
      // Reordering workspaces
      const oldIndex = localWorkspaces.findIndex(w => w.id === active.id);
      const newIndex = localWorkspaces.findIndex(w => w.id === over.id);
      const reordered = arrayMove(localWorkspaces, oldIndex, newIndex);
      setLocalWorkspaces(reordered);
      onReorderWorkspaces?.(reordered);
    } else {
      // Reordering SOWs within a workspace
      const activeSOW = localWorkspaces.flatMap(w => w.sows).find(s => s.id === active.id);
      const overSOW = localWorkspaces.flatMap(w => w.sows).find(s => s.id === over.id);
      
      if (activeSOW && overSOW && activeSOW.workspaceId === overSOW.workspaceId) {
        const workspaceId = activeSOW.workspaceId;
        const workspace = localWorkspaces.find(w => w.id === workspaceId);
        
        if (workspace) {
          const oldIndex = workspace.sows.findIndex(s => s.id === active.id);
          const newIndex = workspace.sows.findIndex(s => s.id === over.id);
          const reorderedSOWs = arrayMove(workspace.sows, oldIndex, newIndex);
          
          const updatedWorkspaces = localWorkspaces.map(w =>
            w.id === workspaceId ? { ...w, sows: reorderedSOWs } : w
          );
          setLocalWorkspaces(updatedWorkspaces);
          onReorderSOWs?.(workspaceId, reorderedSOWs);
        }
      }
    }
  };

  // Sortable Workspace Component
  function SortableWorkspaceItem({ workspace }: { workspace: Workspace }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: workspace.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const isExpanded = expandedWorkspaces.has(workspace.id);

    return (
      <div ref={setNodeRef} style={style}>
        {/* Workspace Item */}
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800/50 rounded-lg group relative">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-gray-500" />
          </button>

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

          {/* Workspace Name (truncated to prevent overflow) */}
          <div className="flex-1 min-w-0 max-w-[140px]">
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
                onClick={() => {
                  onSelectWorkspace(workspace.id);
                }}
                className={`w-full text-left px-2 py-1 text-sm transition-colors truncate ${
                  currentWorkspaceId === workspace.id 
                    ? 'text-[#1CBF79] font-medium' 
                    : 'text-gray-300 hover:text-white'
                }`}
                title={workspace.name}
              >
                {workspace.name}
              </button>
            )}
          </div>

          {/* Action Buttons - ALWAYS VISIBLE with guaranteed space */}
          <div className="flex gap-1.5 flex-shrink-0 ml-2">
            {/* Add New Doc */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNewSOWWorkspaceId(workspace.id);
                setShowNewSOWModal(true);
              }}
              className="p-1.5 bg-gray-700/50 hover:bg-[#1CBF79]/30 rounded text-[#1CBF79] hover:text-white transition-all"
              title="New Doc"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Rename */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(workspace.id);
                setRenameValue(workspace.name);
              }}
              className="p-1.5 bg-gray-700/50 hover:bg-blue-500/30 rounded text-blue-400 hover:text-white transition-all"
              title="Rename"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete workspace "${workspace.name}"? This will delete all SOWs inside.`)) {
                  onDeleteWorkspace(workspace.id);
                }
              }}
              className="p-1.5 bg-gray-700/50 hover:bg-red-500/30 rounded text-red-400 hover:text-white transition-all"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SOWs in Workspace (when expanded) */}
        {isExpanded && (
          <div className="ml-6 space-y-0.5">
            <SortableContext items={workspace.sows.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {workspace.sows.map((sow) => (
                <SortableSOWItem key={sow.id} sow={sow} />
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    );
  }

  // Sortable SOW Component
  function SortableSOWItem({ sow }: { sow: SOW }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: sow.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg group transition-colors ${
          currentSOWId === sow.id
            ? "bg-[#0e2e33] text-white"
            : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
        }`}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3 text-gray-500" />
        </button>

        <FileText className="w-4 h-4 flex-shrink-0" />

        {/* SOW Name (truncated to prevent overflow) */}
        <div className="flex-1 min-w-0 max-w-[120px]">
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
              title={sow.name}
            >
              {sow.name}
            </button>
          )}
        </div>

        {/* SOW Actions - ALWAYS VISIBLE with guaranteed space */}
        <div className="flex gap-1 flex-shrink-0 ml-1">
          {/* Rename */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenamingId(sow.id);
              setRenameValue(sow.name);
            }}
            className="p-1 bg-gray-700/50 hover:bg-blue-500/30 rounded text-blue-400 hover:text-white transition-all"
            title="Rename"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete SOW "${sow.name}"?`)) {
                onDeleteSOW(sow.id);
              }
            }}
            className="p-1 bg-gray-700/50 hover:bg-red-500/30 rounded text-red-400 hover:text-white transition-all"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

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
        {/* Search Bar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800">
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs bg-gray-900 border-gray-700 text-gray-300 placeholder:text-gray-600"
          />
        </div>
        
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

        {/* Workspaces List - Categorized */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* CLIENT WORKSPACES CATEGORY */}
              {(() => {
                const clientWorkspaces = localWorkspaces.filter(w => 
                  !isAgentWorkspace(w) && !isSystemWorkspace(w) &&
                  (w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   w.sows.some(sow => sow.name.toLowerCase().includes(searchQuery.toLowerCase())))
                );
                
                if (clientWorkspaces.length === 0 && searchQuery === '') {
                  return null;
                }
                
                return (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleCategory('clients')}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                    >
                      {expandedCategories.has('clients') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <LayoutDashboard className="w-4 h-4 text-[#1CBF79]" />
                      <span>CLIENT WORKSPACES</span>
                      <span className="ml-auto text-xs text-gray-500">({clientWorkspaces.length})</span>
                    </button>
                    
                    {expandedCategories.has('clients') && (
                      <div className="ml-2 space-y-0.5">
                        <SortableContext 
                          items={clientWorkspaces.map(w => w.id)} 
                          strategy={verticalListSortingStrategy}
                        >
                          {clientWorkspaces.map((workspace) => (
                            <SortableWorkspaceItem key={workspace.id} workspace={workspace} />
                          ))}
                        </SortableContext>
                        
                        {clientWorkspaces.length === 0 && (
                          <div className="px-4 py-4 text-center">
                            <p className="text-xs text-gray-600">No client workspaces yet</p>
                            <p className="text-xs text-gray-700 mt-1">Click + above to create one</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* AI AGENTS CATEGORY */}
              {(() => {
                const agentWorkspaces = localWorkspaces.filter(w => 
                  isAgentWorkspace(w) &&
                  w.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                if (agentWorkspaces.length === 0) {
                  return null;
                }
                
                return (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleCategory('agents')}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                    >
                      {expandedCategories.has('agents') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>AI AGENTS</span>
                      <span className="ml-auto text-xs text-gray-500">({agentWorkspaces.length})</span>
                    </button>
                    
                    {expandedCategories.has('agents') && (
                      <div className="ml-2 space-y-0.5">
                        {agentWorkspaces.map((workspace) => (
                          <div key={workspace.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800/50 rounded-lg group">
                            <button
                              onClick={() => onSelectWorkspace(workspace.id)}
                              className={`flex-1 text-left text-xs transition-colors truncate ${
                                currentWorkspaceId === workspace.id 
                                  ? 'text-purple-400 font-medium' 
                                  : 'text-gray-400 hover:text-white'
                              }`}
                              title={workspace.name}
                            >
                              {workspace.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SYSTEM TOOLS CATEGORY */}
              {(() => {
                const systemWorkspaces = localWorkspaces.filter(w => 
                  isSystemWorkspace(w) &&
                  w.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                if (systemWorkspaces.length === 0) {
                  return null;
                }
                
                return (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleCategory('system')}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                    >
                      {expandedCategories.has('system') ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="text-blue-400">⚙️</span>
                      <span>SYSTEM TOOLS</span>
                      <span className="ml-auto text-xs text-gray-500">({systemWorkspaces.length})</span>
                    </button>
                    
                    {expandedCategories.has('system') && (
                      <div className="ml-2 space-y-0.5">
                        {systemWorkspaces.map((workspace) => (
                          <div key={workspace.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800/50 rounded-lg group">
                            <button
                              onClick={() => onSelectWorkspace(workspace.id)}
                              className={`flex-1 text-left text-xs transition-colors truncate ${
                                currentWorkspaceId === workspace.id 
                                  ? 'text-blue-400 font-medium' 
                                  : 'text-gray-400 hover:text-white'
                              }`}
                              title={workspace.name}
                            >
                              {workspace.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </DndContext>

            {localWorkspaces.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-600">No workspaces yet</p>
                <p className="text-xs text-gray-700 mt-2">Click the + button to create one</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* New Doc Modal */}
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
