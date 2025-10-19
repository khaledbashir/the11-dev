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
} from "lucide-react";

interface Document {
  id: string;
  title: string;
  content: any;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  documents: Document[];
  folders: Folder[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onNewDoc: (folderId?: string) => void;
  onRenameDoc: (id: string, title: string) => void;
  onDeleteDoc: (id: string) => void;
  onNewFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

export default function SidebarClean({
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
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

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

  const unorganizedDocs = documents.filter(doc => !doc.folderId);

  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-gray-950 border-r border-gray-700 transition-all duration-300 z-30 flex flex-col ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden`}
    >
      {/* Header with Title and Actions */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">Documents</h2>
        <div className="flex gap-2">
          <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-800">
                <FolderPlus className="h-4 w-4 text-gray-400" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">New Folder</DialogTitle>
              </DialogHeader>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={handleNewFolder} className="bg-[#1CBF79] hover:bg-[#15a366] text-white">
                Create
              </Button>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => onNewDoc()}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-gray-800"
          >
            <Plus className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Folders with their documents */}
          {folders.map((folder) => {
            const folderDocs = documents.filter(doc => doc.folderId === folder.id);
            return (
              <div key={folder.id} className="space-y-1 mb-3">
                {/* Folder Header */}
                <div className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold text-gray-400 hover:bg-gray-800 group">
                  <Folder className="h-4 w-4 text-gray-500" />
                  {renamingId === folder.id ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(folder.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(folder.id)}
                      className="h-6 py-0 text-xs flex-1 bg-gray-800 border-gray-600"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate">{folder.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(folder.id);
                          setRenameValue(folder.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                      >
                        <Edit3 className="h-3 w-3 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                      >
                        <Trash2 className="h-3 w-3 text-gray-500" />
                      </button>
                    </>
                  )}
                </div>

                {/* Documents in Folder */}
                <div className="ml-2 space-y-0">
                  {folderDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => onSelectDoc(doc.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors group ${
                        currentDocId === doc.id
                          ? 'bg-[#0e2e33] text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      {renamingId === doc.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(doc.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(doc.id)}
                          className="h-6 py-0 text-xs flex-1 bg-gray-800 border-gray-600"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="flex-1 truncate">{doc.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(doc.id);
                              setRenameValue(doc.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDoc(doc.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Unorganized Documents */}
          {unorganizedDocs.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Other Documents
              </div>
              <div className="space-y-0">
                {unorganizedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDoc(doc.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors group ${
                      currentDocId === doc.id
                        ? 'bg-[#0e2e33] text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    {renamingId === doc.id ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(doc.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(doc.id)}
                        className="h-6 py-0 text-xs flex-1 bg-gray-800 border-gray-600"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className="flex-1 truncate">{doc.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(doc.id);
                            setRenameValue(doc.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDoc(doc.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
