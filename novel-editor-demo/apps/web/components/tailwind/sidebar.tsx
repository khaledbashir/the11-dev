"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Folder,
  FolderPlus,
  GripVertical
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface Document {
  id: string;
  title: string;
  content: any;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  documents: Document[];
  folders: Folder[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onRenameDoc: (id: string, title: string) => void;
  onDeleteDoc: (id: string) => void;
  onNewFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveDoc: (docId: string, folderId?: string) => void;
}

// Draggable Document Component
function DraggableDocument({
  doc,
  currentDocId,
  renamingId,
  renameValue,
  onSelectDoc,
  onRename,
  onDelete,
  setRenamingId,
  setRenameValue,
}: {
  doc: Document;
  currentDocId: string | null;
  renamingId: string | null;
  renameValue: string;
  onSelectDoc: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  setRenamingId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer group ${
        currentDocId === doc.id ? 'bg-accent' : ''
      }`}
      onClick={() => onSelectDoc(doc.id)}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <FileText className="h-4 w-4 text-muted-foreground" />
      {renamingId === doc.id ? (
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => onRename(doc.id)}
          onKeyDown={(e) => e.key === 'Enter' && onRename(doc.id)}
          className="h-6 py-0 text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-sm flex-1 truncate">{doc.title}</span>
      )}
      <button
        className="ml-auto p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e)=>{e.stopPropagation();setRenamingId(doc.id);setRenameValue(doc.title);}}
        title="Rename document"
      >
        <Edit3 className="h-4 w-4" />
      </button>
      <button
        className="ml-1 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e)=>{e.stopPropagation();onDelete(doc.id);}}
        title="Delete document"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// Droppable Folder Component
function DroppableFolder({
  folder,
  children,
  renamingId,
  renameValue,
  onRename,
  onDelete,
  setRenamingId,
  setRenameValue,
}: {
  folder: Folder;
  children: React.ReactNode;
  renamingId: string | null;
  renameValue: string;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  setRenamingId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`mb-2 rounded-md transition-colors ${
        isOver ? 'bg-accent/50 ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md group">
        <Folder className="h-4 w-4 text-muted-foreground" />
        {renamingId === folder.id ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => onRename(folder.id)}
            onKeyDown={(e) => e.key === 'Enter' && onRename(folder.id)}
            className="h-6 py-0 text-sm"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium flex-1">{folder.name}</span>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500"
            onClick={() => {
              setRenamingId(folder.id);
              setRenameValue(folder.name);
            }}
            title="Rename folder"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-500"
            onClick={() => onDelete(folder.id)}
            title="Delete folder"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="ml-4 mt-1">{children}</div>
    </div>
  );
}

// Droppable Unorganized Section
function DroppableUnorganized({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'unorganized',
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-2 rounded-md transition-colors p-1 ${
        isOver ? 'bg-accent/50 ring-2 ring-primary' : ''
      }`}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
        Unorganized
      </div>
      {children}
    </div>
  );
}

export default function Sidebar({
  isOpen,
  onToggle,
  documents,
  folders,
  currentDocId,
  onSelectDoc,
  onNewDoc,
  onRenameDoc,
  onDeleteDoc,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDoc,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      if (folders.some(f => f.id === id)) {
        onRenameFolder(id, renameValue);
      } else {
        onRenameDoc(id, renameValue);
      }
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const handleNewFolder = () => {
    if (newFolderName.trim()) {
      onNewFolder(newFolderName);
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const docId = active.id as string;
    const targetId = over.id as string;

    // Check if we're dropping on a folder
    const targetFolder = folders.find(f => f.id === targetId);
    
    if (targetFolder) {
      // Move document to folder
      onMoveDoc(docId, targetFolder.id);
    } else if (targetId === 'unorganized') {
      // Move document to unorganized (no folder)
      onMoveDoc(docId, undefined);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const unorganizedDocs = documents.filter(doc => !doc.folderId);
  const activeDoc = activeId ? documents.find(d => d.id === activeId) : null;

  return (
    <>
      <div
        className={`fixed left-0 top-0 h-screen bg-background border-r border-border transition-all duration-300 z-30 ${
          isOpen ? 'w-64' : 'w-0'
        } overflow-hidden`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents</h2>
          <div className="flex gap-1">
            <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Folder</DialogTitle>
                </DialogHeader>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
                />
                <Button onClick={handleNewFolder}>Create</Button>
              </DialogContent>
            </Dialog>
            <Button onClick={onNewDoc} size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-73px)]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="p-2">
              {folders.map((folder) => {
                const folderDocs = documents.filter(doc => doc.folderId === folder.id);
                return (
                  <DroppableFolder
                    key={folder.id}
                    folder={folder}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onRename={handleRename}
                    onDelete={onDeleteFolder}
                    setRenamingId={setRenamingId}
                    setRenameValue={setRenameValue}
                  >
                    <SortableContext
                      items={folderDocs.map(d => d.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {folderDocs.map((doc) => (
                        <DraggableDocument
                          key={doc.id}
                          doc={doc}
                          currentDocId={currentDocId}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          onSelectDoc={onSelectDoc}
                          onRename={handleRename}
                          onDelete={onDeleteDoc}
                          setRenamingId={setRenamingId}
                          setRenameValue={setRenameValue}
                        />
                      ))}
                    </SortableContext>
                  </DroppableFolder>
                );
              })}
              
              {unorganizedDocs.length > 0 && (
                <DroppableUnorganized isOver={false}>
                  <SortableContext
                    items={unorganizedDocs.map(d => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {unorganizedDocs.map((doc) => (
                      <DraggableDocument
                        key={doc.id}
                        doc={doc}
                        currentDocId={currentDocId}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        onSelectDoc={onSelectDoc}
                        onRename={handleRename}
                        onDelete={onDeleteDoc}
                        setRenamingId={setRenamingId}
                        setRenameValue={setRenameValue}
                      />
                    ))}
                  </SortableContext>
                </DroppableUnorganized>
              )}
            </div>
            
            <DragOverlay>
              {activeDoc ? (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-accent rounded-md shadow-lg">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{activeDoc.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </div>
      
      <Button
        onClick={onToggle}
        size="sm"
        variant="outline"
        className={`fixed top-4 z-40 transition-all duration-300 ${
          isOpen ? 'left-64' : 'left-4'
        }`}
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
    </>
  );
}
