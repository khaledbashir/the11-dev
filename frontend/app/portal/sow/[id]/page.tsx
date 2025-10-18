"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Sparkles, Download, CheckCircle, MessageCircle, ArrowLeft, 
  FileText, DollarSign, Calendar, Eye, Share2, Clock,
  Target, TrendingUp, Users, Zap, Home
} from 'lucide-react';
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

type TabView = 'overview' | 'content' | 'pricing' | 'timeline';

export default function ClientPortalPage() {
  const params = useParams();
  const sowId = params.id as string;
  const [sow, setSOW] = useState<SOWData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          
          // Import TipTap generateHTML function and ALL extensions used in the editor
          const { generateHTML } = await import('@tiptap/html');
          const { defaultExtensions } = await import('@/components/tailwind/extensions');
          
          // Generate HTML with all extensions to support custom nodes like editablePricingTable
          htmlContent = generateHTML(contentData, defaultExtensions);
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
    <div className="min-h-screen bg-[#0E0F0F] flex">
      {/* 🔥 SIDEBAR NAVIGATION - Like main app */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-[#1A1A1D] border-r border-[#2A2A2D] flex flex-col overflow-hidden`}>
        {/* Logo Header */}
        <div className="p-6 border-b border-[#2A2A2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">SG</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Social Garden</h2>
              <p className="text-gray-400 text-xs">Client Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'overview' 
                ? 'bg-[#1CBF79] text-white shadow-lg shadow-[#1CBF79]/20' 
                : 'text-gray-400 hover:bg-[#2A2A2D] hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'content' 
                ? 'bg-[#1CBF79] text-white shadow-lg shadow-[#1CBF79]/20' 
                : 'text-gray-400 hover:bg-[#2A2A2D] hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">Full Document</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'pricing' 
                ? 'bg-[#1CBF79] text-white shadow-lg shadow-[#1CBF79]/20' 
                : 'text-gray-400 hover:bg-[#2A2A2D] hover:text-white'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Pricing</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'timeline' 
                ? 'bg-[#1CBF79] text-white shadow-lg shadow-[#1CBF79]/20' 
                : 'text-gray-400 hover:bg-[#2A2A2D] hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="font-medium">Timeline</span>
          </button>

          <div className="pt-4 mt-4 border-t border-[#2A2A2D]">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                showChat 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20' 
                  : 'text-gray-400 hover:bg-[#2A2A2D] hover:text-white'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">AI Assistant</span>
            </button>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2A2A2D] space-y-2">
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="w-full gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D] hover:text-white"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          
          {!accepted && (
            <Button
              onClick={handleAcceptSOW}
              className="w-full gap-2 bg-[#1CBF79] hover:bg-[#15965E] text-white shadow-lg shadow-[#1CBF79]/20"
            >
              <CheckCircle className="w-4 h-4" />
              Accept Proposal
            </Button>
          )}
        </div>
      </aside>

      {/* 🔥 MAIN CONTENT AREA */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-[#1A1A1D]/80 backdrop-blur-xl border-b border-[#2A2A2D]">
          <div className="px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-[#2A2A2D] rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div>
                <h1 className="text-xl font-bold text-white">{sow?.clientName}</h1>
                <p className="text-sm text-gray-400">{sow?.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {accepted && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Accepted</span>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D]"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          {renderTabContent()}
        </div>
      </main>

      {/* 🔥 AI CHAT PANEL - Side drawer */}
      {showChat && (
        <aside className="w-96 bg-[#1A1A1D] border-l border-[#2A2A2D] flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-[#2A2A2D] bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold">AI Assistant</h3>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-400">Ask me anything about this proposal</p>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {!sow?.embedId ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-semibold mb-2">Loading AI Assistant...</p>
                <p className="text-sm text-gray-400">Preparing knowledge base</p>
              </div>
            ) : (
              <div id="social-garden-chat-container" className="h-full">
                {/* AI widget loads here */}
              </div>
            )}
          </div>

          {/* Suggested Questions */}
          <div className="p-4 border-t border-[#2A2A2D]">
            <p className="text-xs text-gray-500 mb-3 font-semibold uppercase">Quick Questions</p>
            <div className="space-y-2">
              {[
                "What's the total investment?",
                "Timeline for deliverables?",
                "What's included in social media?",
              ].map((q, i) => (
                <button
                  key={i}
                  className="w-full text-left text-xs p-3 rounded-lg bg-[#2A2A2D] hover:bg-[#3A3A3D] text-gray-300 transition-colors border border-gray-700 hover:border-[#1CBF79]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );

  // 🔥 RENDER TAB CONTENT
  function renderTabContent() {
    if (!sow) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 max-w-5xl">
            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-[#1CBF79]/20 to-[#15965E]/10 border border-[#1CBF79]/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-[#1CBF79]/20 rounded-lg">
                    <DollarSign className="w-6 h-6 text-[#1CBF79]" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">Total Investment</span>
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  ${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">AUD (inc. GST)</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">Created</span>
                </div>
                <p className="text-xl font-bold text-white mb-1">
                  {new Date(sow.createdAt).toLocaleDateString('en-AU', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-xs text-gray-500">Proposal Date</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">Status</span>
                </div>
                <p className="text-xl font-bold text-white mb-1">
                  {accepted ? 'Accepted' : 'Pending'}
                </p>
                <p className="text-xs text-gray-500">Proposal Status</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-[#1CBF79]/10 via-blue-500/10 to-purple-500/10 border border-[#2A2A2D] rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-4">What would you like to do?</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('content')}
                  className="p-6 bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl hover:border-[#1CBF79] transition-all group"
                >
                  <FileText className="w-8 h-8 text-[#1CBF79] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-bold mb-2">Read Full Proposal</h3>
                  <p className="text-sm text-gray-400">View complete scope of work</p>
                </button>

                <button
                  onClick={() => setActiveTab('pricing')}
                  className="p-6 bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl hover:border-blue-500 transition-all group"
                >
                  <TrendingUp className="w-8 h-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-bold mb-2">View Pricing</h3>
                  <p className="text-sm text-gray-400">Detailed cost breakdown</p>
                </button>

                <button
                  onClick={() => setShowChat(true)}
                  className="p-6 bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl hover:border-purple-500 transition-all group"
                >
                  <Sparkles className="w-8 h-8 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-bold mb-2">Ask AI Questions</h3>
                  <p className="text-sm text-gray-400">Get instant answers</p>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  className="p-6 bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl hover:border-pink-500 transition-all group"
                >
                  <Download className="w-8 h-8 text-pink-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-bold mb-2">Download PDF</h3>
                  <p className="text-sm text-gray-400">Save for your records</p>
                </button>
              </div>
            </div>

            {/* Why Social Garden */}
            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Why Choose Social Garden?</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#1CBF79]/10 rounded-lg flex-shrink-0">
                    <Zap className="w-6 h-6 text-[#1CBF79]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-2">Fast Turnaround</h3>
                    <p className="text-sm text-gray-400">Quick delivery without compromising quality</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg flex-shrink-0">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-2">Dedicated Team</h3>
                    <p className="text-sm text-gray-400">Your own account manager and specialists</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg flex-shrink-0">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-2">Results-Focused</h3>
                    <p className="text-sm text-gray-400">We measure success by your ROI</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-pink-500/10 rounded-lg flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-2">Proven Track Record</h3>
                    <p className="text-sm text-gray-400">100+ successful campaigns delivered</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'content':
        return (
          <div className="max-w-4xl">
            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-12">
              <div 
                className="prose prose-invert prose-lg max-w-none 
                  prose-headings:text-white 
                  prose-p:text-gray-300 
                  prose-strong:text-white
                  prose-a:text-[#1CBF79]
                  prose-ul:text-gray-300
                  prose-ol:text-gray-300
                  prose-table:border-[#2A2A2D]
                  prose-th:bg-[#2A2A2D] prose-th:text-white
                  prose-td:border-[#2A2A2D] prose-td:text-gray-300"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="max-w-4xl space-y-6">
            <div className="bg-gradient-to-r from-[#1CBF79]/20 to-blue-500/20 border border-[#1CBF79]/30 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-white mb-2">Investment Breakdown</h2>
              <p className="text-gray-400">Transparent pricing for exceptional value</p>
            </div>

            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl overflow-hidden">
              {/* Extract pricing table from HTML content */}
              <div 
                className="prose prose-invert max-w-none p-8
                  prose-table:w-full
                  prose-th:bg-[#2A2A2D] prose-th:text-white prose-th:p-4
                  prose-td:border-[#2A2A2D] prose-td:text-gray-300 prose-td:p-4
                  prose-tr:border-b prose-tr:border-[#2A2A2D]"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>

            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Total Investment</h3>
                  <p className="text-sm text-gray-400">All fees included</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-[#1CBF79]">
                    ${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-400">AUD (inc. GST)</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="max-w-4xl space-y-6">
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-white mb-2">Project Timeline</h2>
              <p className="text-gray-400">Milestones and deliverables schedule</p>
            </div>

            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-8">
              <p className="text-gray-400 mb-6">Timeline information extracted from your proposal:</p>
              <div 
                className="prose prose-invert max-w-none
                  prose-headings:text-white 
                  prose-p:text-gray-300"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  }
}