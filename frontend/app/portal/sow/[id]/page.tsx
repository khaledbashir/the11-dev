"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sparkles, Download, CheckCircle, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/tailwind/ui/button';

interface SOWData {
  id: string;
  title: string;
  clientName: string;
  htmlContent: string;
  totalInvestment: number;
  createdAt: string;
  workspaceSlug: string;
  embedId?: string;
}

export default function ClientPortalPage() {
  const params = useParams();
  const sowId = params.id as string;
  const [sow, setSOW] = useState<SOWData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Load SOW data
    loadSOW();
  }, [sowId]);

  useEffect(() => {
    // Inject AnythingLLM embed script with Social Garden branding
    if (sow?.embedId && showChat) {
      const existingScript = document.getElementById('anythingllm-embed-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'anythingllm-embed-script';
        
        // Use the dynamically generated embed ID for this client's workspace
        script.setAttribute('data-embed-id', sow.embedId);
        script.setAttribute('data-base-api-url', 'https://socialgarden-anything-llm.vo0egb.easypanel.host/api/embed');
        
        // 🎨 SOCIAL GARDEN BRANDING - NO AnythingLLM mentions!
        script.setAttribute('data-assistant-name', 'Social Garden AI Assistant'); // Rebrand!
        script.setAttribute('data-button-color', '#0e2e33'); // Social Garden dark teal
        script.setAttribute('data-text-color', '#ffffff'); // White text
        script.setAttribute('data-chat-icon', 'sparkles'); // Sparkles icon (matches brand)
        
        // Positioning for sidebar integration
        script.setAttribute('data-position', 'custom'); // We control the position
        script.setAttribute('data-window-width', '100%'); // Full width in sidebar
        script.setAttribute('data-window-height', '600px'); // Fixed height
        script.setAttribute('data-open-on-load', 'on'); // Auto-open when loaded
        
        // Default prompt suggestions
        script.setAttribute('data-prompt-suggestions', JSON.stringify([
          "What's the total investment?",
          "How many hours for social media?",
          "What deliverables are included?",
          "When does the project start?"
        ]));
        
        script.src = 'https://socialgarden-anything-llm.vo0egb.easypanel.host/embed/anythingllm-chat-widget.min.js';
        
        document.body.appendChild(script);
        
        console.log(`✅ Social Garden AI Chat loaded for ${sow.clientName}`);
      }
    }
    
    // Cleanup script when component unmounts or chat closes
    return () => {
      if (!showChat) {
        const script = document.getElementById('anythingllm-embed-script');
        if (script) {
          script.remove();
          console.log('🧹 Social Garden AI Chat removed');
        }
      }
    };
  }, [sow, showChat]);

  const loadSOW = async () => {
    try {
      setLoading(true);
      
      // Fetch SOW from database API
      const response = await fetch(`/api/sow/${sowId}`);
      
      if (!response.ok) {
        console.error('Failed to fetch SOW:', response.statusText);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.sow) {
        const sowData = data.sow;
        
        // Extract client name from title or use client_name field
        const clientName = sowData.client_name || sowData.title.split(':')[1]?.split('-')[0]?.trim() || 'Client';
        const workspaceSlug = sowData.workspace_slug || clientName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        
        // Convert TipTap JSON to HTML if needed
        let htmlContent = '';
        try {
          const contentData = typeof sowData.content === 'string' 
            ? JSON.parse(sowData.content) 
            : sowData.content;
          
          // Import TipTap generateHTML function
          const { generateHTML } = await import('@tiptap/html');
          const StarterKit = (await import('@tiptap/starter-kit')).default;
          
          htmlContent = generateHTML(contentData, [StarterKit]);
        } catch (error) {
          console.error('Error converting content to HTML:', error);
          // Fallback: if it's already HTML, use it directly
          htmlContent = typeof sowData.content === 'string' && sowData.content.startsWith('<') 
            ? sowData.content 
            : '<p>Error loading content</p>';
        }
        
        // Get or create embed ID for this client's workspace
        let embedId = sowData.embed_id;
        if (!embedId) {
          try {
            const { anythingLLM } = await import('@/lib/anythingllm');
            embedId = await anythingLLM.getOrCreateEmbedId(workspaceSlug) || undefined;
          } catch (error) {
            console.error('Error getting embed ID:', error);
          }
        }
        
        setSOW({
          id: sowData.id,
          title: sowData.title,
          clientName,
          htmlContent,
          totalInvestment: parseFloat(sowData.total_investment) || 0,
          createdAt: sowData.created_at,
          workspaceSlug,
          embedId
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading SOW:', error);
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    // Trigger PDF download
    window.open(`/api/generate-pdf?sowId=${sowId}`, '_blank');
  };

  const handleAcceptSOW = () => {
    // Will implement e-signature modal in Phase 2
    setAccepted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#0e2e33] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading your proposal...</p>
        </div>
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">SOW Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8">This proposal doesn't exist or has been removed.</p>
          <Button onClick={() => window.location.href = '/'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0e2e33] rounded-xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">SG</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Social Garden</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Statement of Work</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowChat(!showChat)}
              variant="outline"
              className="gap-2 border-[#20e28f] text-[#0e2e33] hover:bg-[#20e28f]/10"
            >
              <Sparkles className="w-4 h-4" />
              {showChat ? 'Hide' : 'Ask'} AI
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            {!accepted && (
              <Button
                onClick={handleAcceptSOW}
                className="gap-2 bg-[#0e2e33] hover:bg-[#0e2e33]/90"
              >
                <CheckCircle className="w-4 h-4" />
                Accept SOW
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className={`${showChat ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Hero Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 mb-8 border-t-4 border-[#0e2e33]">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Proposal For</p>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{sow.clientName}</h2>
                  <p className="text-slate-600 dark:text-slate-400">{sow.title}</p>
                </div>
                {accepted && (
                  <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Accepted
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Investment</p>
                  <p className="text-3xl font-bold text-[#0e2e33] dark:text-[#20e28f]">
                    ${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">AUD (inc. GST)</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Created</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {new Date(sow.createdAt).toLocaleDateString('en-AU', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* SOW Content */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
              <div 
                className="prose prose-slate dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>

            {/* Questions Section */}
            <div className="mt-8 bg-gradient-to-r from-[#0e2e33] to-[#0a2328] rounded-2xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Have Questions?</h3>
                  <p className="text-white/80 mb-4">
                    Our AI assistant has analyzed this entire proposal and can answer any questions you have about scope, pricing, deliverables, or timelines.
                  </p>
                  <Button
                    onClick={() => setShowChat(true)}
                    variant="secondary"
                    className="bg-white text-[#0e2e33] hover:bg-white/90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Ask AI About This Proposal
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Chat Sidebar */}
          {showChat && (
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div className="bg-gradient-to-r from-[#0e2e33] to-[#0a2328] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#20e28f]" />
                        <h3 className="text-white font-bold">AI Assistant</h3>
                      </div>
                      <Button
                        onClick={() => setShowChat(false)}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/10"
                      >
                        ✕
                      </Button>
                    </div>
                    <p className="text-white/70 text-sm mt-1">Ask me anything about this proposal</p>
                  </div>
                  
                  {/* Social Garden AI Chat Widget */}
                  <div 
                    id="social-garden-chat-container" 
                    className="h-[600px] bg-slate-50 dark:bg-slate-900 relative overflow-hidden"
                  >
                    {/* Chat interface will load here via script */}
                    {!sow.embedId ? (
                      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                        <div className="text-center">
                          <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#20e28f] animate-pulse" />
                          <p>Loading AI Assistant...</p>
                          <p className="text-xs mt-1">Preparing {sow.clientName}'s knowledge base</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                        <div className="text-center">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#20e28f]" />
                          <p className="font-semibold">AI Ready!</p>
                          <p className="text-xs mt-1">Click "Ask AI" to start chatting</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Custom CSS to hide AnythingLLM branding in widget */}
                  <style jsx global>{`
                    /* Hide any "Powered by AnythingLLM" or similar branding */
                    [data-embed-id] a[href*="anythingllm.com"],
                    [data-embed-id] *[class*="powered"],
                    [data-embed-id] *[class*="branding"],
                    iframe[src*="anythingllm"] + div a[href*="anythingllm.com"] {
                      display: none !important;
                      visibility: hidden !important;
                      opacity: 0 !important;
                    }
                    
                    /* Ensure Social Garden colors */
                    [data-embed-id] {
                      --primary-color: #0e2e33;
                      --accent-color: #20e28f;
                    }
                  `}</style>

                  {/* Suggested Questions */}
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-semibold">Try asking:</p>
                    <div className="space-y-2">
                      {[
                        "What's the total investment?",
                        "How many hours for social media?",
                        "What deliverables are included?",
                        "When does the project start?"
                      ].map((q, i) => (
                        <button
                          key={i}
                          className="w-full text-left text-xs p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            <strong className="text-slate-900 dark:text-white">Social Garden Pty Ltd</strong>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            marketing@socialgarden.com.au | www.socialgarden.com.au
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
            This document is confidential and intended solely for the addressee.
          </p>
        </div>
      </footer>
    </div>
  );
}
