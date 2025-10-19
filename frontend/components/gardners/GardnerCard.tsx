'use client';

import { useState } from 'react';
import { Edit2, Trash2, MessageSquare, Thermometer, Hash, MessageCircle } from 'lucide-react';

interface Gardner {
  id: string;
  name: string;
  slug: string;
  category: string;
  systemPrompt: string | null;
  temperature: number | null;
  chatHistory: number | null;
  chatMode: string | null;
  chatProvider: string | null;
  chatModel: string | null;
  createdAt: string;
  lastUpdated: string;
}

interface GardnerCardProps {
  gardner: Gardner;
  onEdit: (gardner: Gardner) => void;
  onDelete: (slug: string) => void;
  onChat: (slug: string) => void;
}

export default function GardnerCard({ gardner, onEdit, onDelete, onChat }: GardnerCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      sow: '🏗️',
      email: '✉️',
      blog: '📝',
      social: '📱',
      custom: '✨',
    };
    return icons[category] || '✨';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      sow: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
      email: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
      blog: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
      social: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30',
      custom: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    };
    return colors[category] || colors.custom;
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${gardner.name}"? This will also delete the AnythingLLM workspace and cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(gardner.slug);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="group relative bg-[#0e1713] border border-[#1a2f23] rounded-lg p-6 hover:border-emerald-500/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getCategoryColor(gardner.category)} flex items-center justify-center text-2xl`}>
            {getCategoryIcon(gardner.category)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{gardner.name}</h3>
            <p className="text-sm text-gray-400 capitalize">{gardner.category}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onChat(gardner.slug)}
            className="p-2 hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Chat with Gardner"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            onClick={() => onEdit(gardner)}
            className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Edit Gardner"
          >
            <Edit2 className="w-4 h-4 text-blue-400" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
            title="Delete Gardner"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* System Prompt Preview */}
      {gardner.systemPrompt && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">System Prompt</p>
          <div className="text-sm text-gray-400 bg-[#0a0f0d] rounded px-3 py-2 font-mono max-h-20 overflow-hidden">
            {gardner.systemPrompt.substring(0, 120)}...
          </div>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Temperature */}
        {gardner.temperature !== null && (
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400">Temp:</span>
            <span className="text-white font-medium">{gardner.temperature}</span>
          </div>
        )}

        {/* Chat History */}
        {gardner.chatHistory !== null && (
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400">History:</span>
            <span className="text-white font-medium">{gardner.chatHistory}</span>
          </div>
        )}

        {/* Chat Mode */}
        {gardner.chatMode && (
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400">Mode:</span>
            <span className="text-white font-medium capitalize">{gardner.chatMode}</span>
          </div>
        )}

        {/* Model */}
        {gardner.chatModel && (
          <div className="flex items-center gap-2 col-span-2">
            <span className="text-gray-400">Model:</span>
            <span className="text-white font-medium text-xs">{gardner.chatModel}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[#1a2f23] flex items-center justify-between text-xs text-gray-500">
        <span>Created {new Date(gardner.createdAt).toLocaleDateString()}</span>
        <span className="text-emerald-400/50">#{gardner.slug}</span>
      </div>
    </div>
  );
}
