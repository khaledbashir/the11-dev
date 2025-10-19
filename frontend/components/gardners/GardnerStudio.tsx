'use client';

import { useState, useEffect } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import GardnerCard from './GardnerCard';
import GardnerCreator from './GardnerCreator';
import { toast } from 'sonner';

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

interface GardnerStudioProps {
  onSelectGardner: (slug: string) => void;
}

export default function GardnerStudio({ onSelectGardner }: GardnerStudioProps) {
  const [gardners, setGardners] = useState<Gardner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const loadGardners = async () => {
    try {
      const response = await fetch('/api/gardners/list');
      if (!response.ok) throw new Error('Failed to load Gardners');
      
      const data = await response.json();
      setGardners(data.gardners || []);
    } catch (error) {
      console.error('❌ Error loading Gardners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGardners();
  }, []);

  const handleDelete = async (slug: string) => {
    try {
      const response = await fetch(`/api/gardners/${slug}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete Gardner');

      // Remove from UI
      setGardners(prev => prev.filter(g => g.slug !== slug));
      console.log('✅ Gardner deleted:', slug);
      toast.success('Gardner deleted successfully!');
    } catch (error) {
      console.error('❌ Error deleting Gardner:', error);
      toast.error('Failed to delete Gardner. Please try again.');
    }
  };

  const handleEdit = (gardner: Gardner) => {
    // TODO: Open edit modal
    console.log('Edit Gardner:', gardner);
    toast.info('Edit functionality coming soon!');
  };

  const handleChat = (slug: string) => {
    onSelectGardner(slug);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            Gardner Studio
          </h1>
          <p className="text-gray-400 mt-1">
            Your AI writing assistants - specialized for different content needs
          </p>
        </div>
        <button
          onClick={() => setIsCreatorOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Gardner
        </button>
      </div>

      {/* Gardners Grid */}
      {gardners.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Gardners Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first AI writing assistant to get started
          </p>
          <button
            onClick={() => setIsCreatorOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Your First Gardner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gardners.map((gardner) => (
            <GardnerCard
              key={gardner.id}
              gardner={gardner}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChat={handleChat}
            />
          ))}
        </div>
      )}

      {/* Creator Modal */}
      <GardnerCreator
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onSuccess={() => {
          loadGardners();
        }}
      />
    </div>
  );
}
