import { createContext, useContext, useEffect, useState } from 'react';

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  visible: boolean;
  icon: string;
}

export interface AISettings {
  aiModel: string;
  quickActionsEnabled: boolean;
  quickActions: QuickAction[];
}

interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  updateModel: (model: string) => void;
  getVisibleQuickActions: () => QuickAction[];
}

const defaultSettings: AISettings = {
  aiModel: 'google/gemini-2.0-flash-exp:free',
  quickActionsEnabled: true,
  quickActions: [
    { id: '1', label: 'Improve Writing', prompt: 'Improve the writing quality and clarity', visible: true, icon: 'Sparkles' },
    { id: '2', label: 'Shorten', prompt: 'Make this shorter and more concise', visible: true, icon: 'ArrowDownWideNarrow' },
    { id: '3', label: 'Elaborate', prompt: 'Add more details and expand this', visible: true, icon: 'WrapText' },
    { id: '4', label: 'More formal', prompt: 'Rewrite in a more formal, professional tone', visible: true, icon: 'Briefcase' },
    { id: '5', label: 'More casual', prompt: 'Rewrite in a casual, friendly tone', visible: true, icon: 'MessageCircle' },
    { id: '6', label: 'Bulletize', prompt: 'Convert this into bullet points', visible: true, icon: 'List' },
    { id: '7', label: 'Summarize', prompt: 'Create a concise summary', visible: true, icon: 'FileText' },
    { id: '8', label: 'Rewrite', prompt: 'Rewrite this in a different way', visible: true, icon: 'RotateCcw' },
  ],
};

const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);

export function AISettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load AI settings:', e);
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('ai-settings', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save AI settings:', e);
      }
      return updated;
    });
  };

  const updateModel = (model: string) => {
    updateSettings({ aiModel: model });
  };

  const getVisibleQuickActions = () => {
    if (!settings.quickActionsEnabled) return [];
    return settings.quickActions.filter(a => a.visible);
  };

  if (!isLoaded) {
    return <>{children}</>;
  }

  return (
    <AISettingsContext.Provider value={{ settings, updateSettings, updateModel, getVisibleQuickActions }}>
      {children}
    </AISettingsContext.Provider>
  );
}

export function useAISettings() {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error('useAISettings must be used within AISettingsProvider');
  }
  return context;
}
