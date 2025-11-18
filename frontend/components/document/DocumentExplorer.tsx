import React, { useState, useEffect } from "react";
import {
    FileText,
    Folder,
    Plus,
    Search,
    MoreVertical,
    Trash2,
    Edit,
    Download,
} from "lucide-react";
import { Document, Folder as FolderType } from "@/lib/types/sow";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/tailwind/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/tailwind/ui/dialog";
import { useDocumentManager } from "@/hooks/useDocumentManager";

const DocumentExplorer = ({
    workspaceSlug,
    documents: propDocuments,
    folders: propFolders,
    onDocumentSelect,
    activeDocumentId,
    onCreateDocument,
    onRenameDocument,
    onDeleteDocument,
    onMoveDocument,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    isLoading: propIsLoading,
    error: propError,
}: {
    workspaceSlug: string;
    documents?: any[];
    folders?: any[];
    onDocumentSelect: (documentId: string) => void;
    activeDocumentId?: string;
    onCreateDocument?: (folderId?: string) => void;
    onRenameDocument?: (id: string, title: string) => void;
    onDeleteDocument?: (id: string) => void;
    onMoveDocument?: (docId: string, folderId?: string) => void;
    onCreateFolder?: (name: string) => void;
    onRenameFolder?: (id: string, name: string) => void;
    onDeleteFolder?: (id: string) => void;
    isLoading?: boolean;
    error?: Error | null;
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    // Use props or fallback to useDocumentManager for backward compatibility
    const documents = propDocuments || [];
    const folders = propFolders || [];
    const isLoading = propIsLoading || false;
    const error = propError || null;

    // Use provided handlers or fallback to useDocumentManager
    const handleCreateDocument = onCreateDocument || (() => {});
    const handleRenameDocument = onRenameDocument || (() => {});
    const handleDeleteDocumentLocal = onDeleteDocument || (() => {});
    const handleMoveDocument = onMoveDocument || (() => {});
    const handleCreateFolder = onCreateFolder || (() => {});
    const handleRenameFolder = onRenameFolder || (() => {});
    const handleDeleteFolderLocal = onDeleteFolder || (() => {});

    const filteredDocuments =
        documents?.filter(
            (doc) =>
                doc.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
                (activeFolderId ? doc.folderId === activeFolderId : true),
        ) || [];

    const filteredFolders =
        folders?.filter((folder) =>
            folder.name.toLowerCase().includes(searchTerm.toLowerCase()),
        ) || [];

    const handleCreateFolderSubmit = async () => {
        if (!newFolderName.trim()) return;

        try {
            handleCreateFolder(newFolderName);
            setNewFolderName("");
            setCreateFolderDialogOpen(false);
        } catch (err) {
            console.error("Failed to create folder:", err);
        }
    };

    const handleDeleteDocumentClick = async (documentId: string) => {
        if (window.confirm("Are you sure you want to delete this document?")) {
            try {
                handleDeleteDocumentLocal(documentId);
            } catch (err) {
                console.error("Failed to delete document:", err);
            }
        }
    };

    const handleDeleteFolderClick = async (folderId: string) => {
        if (window.confirm("Are you sure you want to delete this folder?")) {
            try {
                handleDeleteFolderLocal(folderId);
                if (activeFolderId === folderId) {
                    setActiveFolderId(null);
                }
            } catch (err) {
                console.error("Failed to delete folder:", err);
            }
        }
    };
    

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-500">
                Error loading documents: {error.message}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search documents..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog
                        open={createFolderDialogOpen}
                        onOpenChange={setCreateFolderDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-1" />
                                Folder
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Folder</DialogTitle>
                                <DialogDescription>
                                    Enter a name for the new folder
                                </DialogDescription>
                            </DialogHeader>
                            <Input
                                placeholder="Folder name"
                                value={newFolderName}
                                onChange={(e) =>
                                    setNewFolderName(e.target.value)
                                }
                            />
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setCreateFolderDialogOpen(false)
                                    }
                                >
                                    Cancel
                                </Button>
                                <Button onClick={handleCreateFolderSubmit}>
                                    Create
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Document
                    </Button>
                </div>

                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {activeFolderId && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="p-1 h-6"
                                onClick={() => setActiveFolderId(null)}
                            >
                                Folders
                            </Button>
                            <span>/</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="p-1 h-6"
                            >
                                {
                                    filteredFolders.find(
                                        (f) => f.id === activeFolderId,
                                    )?.name
                                }
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="p-2">
                    {!activeFolderId && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium mb-2 px-2">
                                Folders
                            </h3>
                            <div className="space-y-1">
                                {filteredFolders.length > 0 ? (
                                    filteredFolders.map((folder) => (
                                        <div
                                            key={folder.id}
                                            className={`flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer ${
                                                activeFolderId === folder.id
                                                    ? "bg-gray-100"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                setActiveFolderId(folder.id)
                                            }
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Folder className="h-4 w-4 text-blue-500" />
                                                <span className="text-sm">
                                                    {folder.name}
                                                </span>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="p-1 h-6 w-6"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleDeleteFolderClick(
                                                                folder.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground px-2">
                                        No folders
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-medium mb-2 px-2">
                            {activeFolderId
                                ? "Documents in folder"
                                : "Recent Documents"}
                        </h3>
                        <div className="mb-2 px-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    handleCreateDocument(activeFolderId)
                                }
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                New Document
                            </Button>
                        </div>
                        <div className="space-y-1">
                            {filteredDocuments.length > 0 ? (
                                filteredDocuments.map((document) => (
                                    <div
                                        key={document.id}
                                        className={`flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer ${
                                            activeDocumentId === document.id
                                                ? "bg-gray-100"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            onDocumentSelect(document.id)
                                        }
                                    >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                            <span className="text-sm truncate">
                                                {document.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            {document.totalInvestment && (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                    $
                                                    {document.totalInvestment.toLocaleString()}
                                                </span>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="p-1 h-6 w-6"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Export
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleDeleteDocumentClick(
                                                                document.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-muted-foreground px-2">
                                    No documents
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentExplorer;
