'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { GARDNER_TEMPLATES, type GardnerTemplate } from '@/lib/gardner-templates';

interface GardnerCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GardnerCreator({ isOpen, onClose, onSuccess }: GardnerCreatorProps) {
  const [step, setStep] = useState<'template' | 'customize'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<GardnerTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [chatHistory, setChatHistory] = useState(20);
  const [chatMode, setChatMode] = useState<'chat' | 'query'>('chat');

  const handleTemplateSelect = (template: GardnerTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setSystemPrompt(template.systemPrompt);
    setTemperature(template.temperature);
    setChatHistory(template.chatHistory);
    setChatMode(template.chatMode);
    setStep('customize');
  };

  const handleStartFromScratch = () => {
    setSelectedTemplate(null);
    setName('');
    setSystemPrompt('');
    setTemperature(0.7);
    setChatHistory(20);
    setChatMode('chat');
    setStep('customize');
  };

  const handleCreate = async () => {
    if (!name || !systemPrompt) {
      alert('Please provide a name and system prompt');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/gardners/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: selectedTemplate?.category || 'custom',
          systemPrompt,
          temperature,
          chatHistory,
          chatMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create Gardner');
      }

      const data = await response.json();
      console.log('✅ Gardner created:', data);

      // Reset form
      setStep('template');
      setSelectedTemplate(null);
      setName('');
      setSystemPrompt('');
      setTemperature(0.7);
      setChatHistory(20);
      setChatMode('chat');

      onSuccess();
      onClose();
    } catch (error) {
      console.error('❌ Error creating Gardner:', error);
      alert(error instanceof Error ? error.message : 'Failed to create Gardner');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#0a0f0d] border border-[#1a2f23] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f23]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Create New Gardner</h2>
              <p className="text-sm text-gray-400">
                {step === 'template' ? 'Choose a template or start from scratch' : 'Customize your AI writing assistant'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'template' ? (
            <>
              {/* Template Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {GARDNER_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-6 bg-[#0e1713] border border-[#1a2f23] rounded-lg hover:border-emerald-500/50 transition-all text-left group"
                  >
                    <div className="text-4xl mb-3">{template.icon}</div>
                    <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {template.category}
                      </span>
                      <span className="text-xs text-gray-500">Temp: {template.temperature}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Start from Scratch */}
              <button
                onClick={handleStartFromScratch}
                className="w-full p-6 bg-[#0e1713] border border-[#1a2f23] border-dashed rounded-lg hover:border-emerald-500/50 transition-all"
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Start from Scratch</h3>
                  <p className="text-sm text-gray-400">Build a custom Gardner with your own configuration</p>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Customize Form */}
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Gardner Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., The Architect, Email Wizard"
                    className="w-full px-4 py-3 bg-[#0e1713] border border-[#1a2f23] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    System Prompt *
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Define the Gardner's personality, expertise, and instructions..."
                    rows={12}
                    className="w-full px-4 py-3 bg-[#0e1713] border border-[#1a2f23] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 font-mono text-sm resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {systemPrompt.length} characters
                  </p>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Temperature: {temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Precise (0)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>

                  {/* Chat History */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Chat History
                    </label>
                    <input
                      type="number"
                      value={chatHistory}
                      onChange={(e) => setChatHistory(parseInt(e.target.value))}
                      min="5"
                      max="100"
                      className="w-full px-4 py-3 bg-[#0e1713] border border-[#1a2f23] rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Number of previous messages to remember (5-100)
                    </p>
                  </div>
                </div>

                {/* Chat Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Chat Mode
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setChatMode('chat')}
                      className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                        chatMode === 'chat'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                          : 'bg-[#0e1713] border-[#1a2f23] text-gray-400 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="font-medium">Chat</div>
                      <div className="text-xs mt-1 opacity-70">Uses general knowledge + documents</div>
                    </button>
                    <button
                      onClick={() => setChatMode('query')}
                      className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                        chatMode === 'query'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                          : 'bg-[#0e1713] border-[#1a2f23] text-gray-400 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="font-medium">Query</div>
                      <div className="text-xs mt-1 opacity-70">Only uses embedded documents</div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a2f23] flex items-center justify-between">
          <div>
            {step === 'customize' && (
              <button
                onClick={() => setStep('template')}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Templates
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg border border-[#1a2f23] text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            {step === 'customize' && (
              <button
                onClick={handleCreate}
                disabled={isCreating || !name || !systemPrompt}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create Gardner
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
