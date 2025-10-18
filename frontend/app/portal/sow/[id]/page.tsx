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

// Pricing Calculator State
interface PricingOption {
  id: string;
  name: string;
  basePrice: number;
  description: string;
  icon: any;
}

export default function ClientPortalPage() {
  const params = useParams();
  const sowId = params.id as string;
  const [sow, setSOW] = useState<SOWData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Interactive Pricing Calculator
  const [selectedServices, setSelectedServices] = useState<string[]>(['social-media', 'content-creation']);
  const [contentPieces, setContentPieces] = useState<number>(12);
  const [socialPosts, setSocialPosts] = useState<number>(20);
  const [adSpend, setAdSpend] = useState<number>(2000);

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
    if (!sow) return;
    
    try {
      // Trigger PDF download via GET request
      const response = await fetch(`/api/generate-pdf?sowId=${sowId}`);
      
      if (!response.ok) {
        console.error('Failed to generate PDF:', response.statusText);
        alert('Failed to download PDF. Please try again.');
        return;
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sow.clientName}-SOW.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
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
    <div className="min-h-screen bg-[#0E0F0F] flex relative">
      {/* 🔥 SIDEBAR NAVIGATION - Like main app */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-[#1A1A1D] border-r border-[#2A2A2D] flex flex-col overflow-hidden`}>
        {/* Logo Header */}
        <div className="p-6 border-b border-[#2A2A2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center shadow-lg shadow-[#1CBF79]/20">
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
      <main className="flex-1 overflow-auto max-w-full">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-[#1A1A1D]/95 backdrop-blur-xl border-b border-[#2A2A2D] shadow-lg">
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
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center shadow-lg shadow-[#1CBF79]/20">
                  <span className="text-white font-bold text-sm">SG</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{sow?.clientName}</h1>
                  <p className="text-sm text-gray-400 truncate max-w-md">{sow?.title}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {accepted && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg shadow-lg shadow-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Accepted</span>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D] hover:border-[#1CBF79]"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-full">
          {renderTabContent()}
        </div>
      </main>

      {/* 🔥 AI CHAT PANEL - Slide in from right with overlay */}
      {showChat && (
        <>
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => setShowChat(false)}
          />
          
          {/* Sliding panel */}
          <aside className="fixed right-0 top-0 bottom-0 w-[450px] bg-[#1A1A1D] border-l border-[#2A2A2D] flex flex-col z-50 shadow-2xl animate-slide-in">
            {/* Chat Header */}
            <div className="p-6 border-b border-[#2A2A2D] bg-gradient-to-r from-[#1CBF79]/10 to-[#15965E]/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center shadow-lg shadow-[#1CBF79]/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">AI Assistant</h3>
                    <p className="text-xs text-gray-400">Powered by Social Garden</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-400">Ask me anything about this proposal - pricing, timeline, deliverables, or scope.</p>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-auto p-6 bg-[#0E0F0F]">
              {!sow?.embedId ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-xl shadow-[#1CBF79]/30">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white font-semibold text-lg mb-2">Loading AI Assistant...</p>
                  <p className="text-sm text-gray-400">Analyzing {sow?.clientName}'s proposal</p>
                  <div className="mt-6 flex gap-2">
                    <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : (
                <div id="social-garden-chat-container" className="h-full">
                  {/* AI widget loads here */}
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-[#1CBF79]/30">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white font-bold text-lg mb-2">AI Ready!</p>
                      <p className="text-sm text-gray-400 mb-6">Start by asking a question below</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Questions */}
            <div className="p-6 border-t border-[#2A2A2D] bg-[#1A1A1D]">
              <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">Quick Questions</p>
              <div className="space-y-2">
                {[
                  { icon: DollarSign, text: "What's the total investment?" },
                  { icon: Clock, text: "Timeline for deliverables?" },
                  { icon: FileText, text: "What's included in the scope?" },
                ].map((q, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-sm p-3 rounded-lg bg-[#2A2A2D] hover:bg-[#3A3A3D] text-gray-300 transition-all border border-gray-700 hover:border-[#1CBF79] flex items-center gap-3 group"
                  >
                    <q.icon className="w-4 h-4 text-gray-500 group-hover:text-[#1CBF79] transition-colors" />
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
      
      {/* Add animation keyframes */}
      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );

  // 🔥 RENDER TAB CONTENT
  function renderTabContent() {
    if (!sow) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Hero Stats - At a Glance */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-[#1CBF79]" />
                At a Glance
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-[#1CBF79]/20 to-[#15965E]/10 border border-[#1CBF79]/30 rounded-xl p-6 hover:scale-105 transition-transform">
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

                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-6 hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-gray-400 text-sm font-medium">Timeline</span>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">
                    {new Date(sow.createdAt).toLocaleDateString('en-AU', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-gray-500">Start Date</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-gray-400 text-sm font-medium">Status</span>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">
                    {accepted ? '✅ Accepted' : '⏳ Pending'}
                  </p>
                  <p className="text-xs text-gray-500">Proposal Status</p>
                </div>
              </div>
            </div>

            {/* Meet the Social Garden Team - VIDEO SECTION */}
            <div className="bg-gradient-to-br from-[#0E2E33]/50 to-[#1A1A1D] border border-[#1CBF79]/20 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Users className="w-8 h-8 text-[#1CBF79]" />
                Meet the Social Garden Team
              </h2>
              <p className="text-gray-400 mb-6">The humans behind your success - real people, real results</p>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Video 1: Meet the Gardeners (3 min team intro) */}
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border-2 border-[#1CBF79]/30 hover:border-[#1CBF79] transition-colors">
                    <iframe
                      width="100%"
                      height="250"
                      src="https://www.youtube.com/embed/uvfBVzdCqZE"
                      title="Meet the Gardeners | Social Garden Team"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full aspect-video"
                    ></iframe>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">🌱 Meet the Gardeners</h3>
                    <p className="text-sm text-gray-400">3-minute team introduction showcasing our culture, collaboration, and commitment to your success</p>
                  </div>
                </div>

                {/* Video 2: CEO Leadership (2 min highlight from 12 min interview) */}
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border-2 border-blue-500/30 hover:border-blue-500 transition-colors">
                    <iframe
                      width="100%"
                      height="250"
                      src="https://www.youtube.com/embed/3t24oBXERUg"
                      title="CEO George Glover | Social Garden Leadership"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full aspect-video"
                    ></iframe>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">🎯 Leadership Vision: CEO George Glover</h3>
                    <p className="text-sm text-gray-400">Strategic insight from our CEO on mission, values, and driving measurable results</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-[#1CBF79]/10 rounded-lg border border-[#1CBF79]/30">
                <Sparkles className="w-5 h-5 text-[#1CBF79]" />
                <p className="text-sm text-gray-300">
                  <strong className="text-white">Why this matters:</strong> You're not just hiring an agency - you're partnering with a team of passionate humans who care about your success.
                </p>
              </div>
            </div>

            {/* Why Social Garden? - Trust Builders */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6 hover:border-[#1CBF79] transition-colors">
                <div className="p-3 bg-[#1CBF79]/20 rounded-lg w-fit mb-4">
                  <TrendingUp className="w-6 h-6 text-[#1CBF79]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Proven Results</h3>
                <p className="text-gray-400 text-sm">Average 40% increase in qualified leads within 90 days. Real data, real growth.</p>
              </div>

              <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6 hover:border-blue-500 transition-colors">
                <div className="p-3 bg-blue-500/20 rounded-lg w-fit mb-4">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Fast Turnaround</h3>
                <p className="text-gray-400 text-sm">Your campaign launches in under 14 days. No delays, no excuses.</p>
              </div>

              <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6 hover:border-purple-500 transition-colors">
                <div className="p-3 bg-purple-500/20 rounded-lg w-fit mb-4">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Dedicated Team</h3>
                <p className="text-gray-400 text-sm">8+ specialists on your account. You're not a number - you're a partner.</p>
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
          <div className="max-w-5xl mx-auto">
            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-12 shadow-xl">
              <div 
                className="prose prose-invert prose-lg max-w-none 
                  prose-headings:text-white prose-headings:font-bold
                  prose-p:text-gray-300 prose-p:leading-relaxed
                  prose-strong:text-white prose-strong:font-semibold
                  prose-a:text-[#1CBF79] prose-a:no-underline hover:prose-a:underline
                  prose-ul:text-gray-300 prose-ul:space-y-2
                  prose-ol:text-gray-300 prose-ol:space-y-2
                  prose-li:text-gray-300
                  prose-table:w-full prose-table:border-collapse prose-table:my-8
                  prose-thead:border-b-2 prose-thead:border-[#2A2A2D]
                  prose-th:bg-[#2A2A2D] prose-th:text-white prose-th:font-bold prose-th:p-4 prose-th:text-left
                  prose-td:border prose-td:border-[#2A2A2D] prose-td:text-gray-300 prose-td:p-4
                  prose-tr:border-b prose-tr:border-[#2A2A2D]
                  prose-tr:hover:bg-[#2A2A2D]/30 prose-tr:transition-colors"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>
          </div>
        );

      case 'pricing':
        // Define available service packages
        const serviceOptions: PricingOption[] = [
          {
            id: 'social-media',
            name: 'Social Media Management',
            basePrice: 1500,
            description: 'Daily posting, community engagement, analytics',
            icon: Users
          },
          {
            id: 'content-creation',
            name: 'Content Creation',
            basePrice: 2000,
            description: 'Blog posts, articles, email campaigns',
            icon: FileText
          },
          {
            id: 'paid-ads',
            name: 'Paid Advertising',
            basePrice: 1200,
            description: 'Google Ads, Facebook Ads management',
            icon: Target
          },
          {
            id: 'seo',
            name: 'SEO Optimization',
            basePrice: 1800,
            description: 'On-page, technical, and off-page SEO',
            icon: TrendingUp
          },
          {
            id: 'analytics',
            name: 'Analytics & Reporting',
            basePrice: 800,
            description: 'Monthly performance reports, insights',
            icon: Eye
          }
        ];

        // Calculate total based on selections
        const baseServicesTotal = serviceOptions
          .filter(s => selectedServices.includes(s.id))
          .reduce((sum, s) => sum + s.basePrice, 0);
        
        const contentCost = contentPieces * 150; // $150 per content piece
        const socialCost = socialPosts * 25; // $25 per social post
        const adManagementFee = adSpend * 0.15; // 15% of ad spend
        
        const subtotal = baseServicesTotal + contentCost + socialCost + adManagementFee;
        const gst = subtotal * 0.1; // 10% GST
        const calculatedTotal = subtotal + gst;

        const toggleService = (serviceId: string) => {
          if (selectedServices.includes(serviceId)) {
            setSelectedServices(selectedServices.filter(id => id !== serviceId));
          } else {
            setSelectedServices([...selectedServices, serviceId]);
          }
        };

        return (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1CBF79]/20 to-blue-500/20 border border-[#1CBF79]/30 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1CBF79]/20 rounded-xl">
                    <DollarSign className="w-8 h-8 text-[#1CBF79]" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">Interactive Pricing Calculator</h2>
                    <p className="text-gray-400">Customize your package in real-time</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Your Investment</p>
                  <p className="text-4xl font-bold text-[#1CBF79]">
                    ${calculatedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Left Column: Service Selection */}
              <div className="col-span-2 space-y-4">
                <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#1CBF79]" />
                    Select Services
                  </h3>
                  <div className="space-y-3">
                    {serviceOptions.map(service => {
                      const isSelected = selectedServices.includes(service.id);
                      const Icon = service.icon;
                      return (
                        <button
                          key={service.id}
                          onClick={() => toggleService(service.id)}
                          className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                            isSelected 
                              ? 'bg-[#1CBF79]/10 border-[#1CBF79] shadow-lg shadow-[#1CBF79]/20' 
                              : 'bg-[#0E0F0F] border-[#2A2A2D] hover:border-[#1CBF79]/50'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#1CBF79]/20' : 'bg-[#2A2A2D]'}`}>
                              <Icon className={`w-5 h-5 ${isSelected ? 'text-[#1CBF79]' : 'text-gray-400'}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className={`font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                  {service.name}
                                </h4>
                                <span className={`text-sm font-bold ${isSelected ? 'text-[#1CBF79]' : 'text-gray-400'}`}>
                                  ${service.basePrice.toLocaleString()}/mo
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">{service.description}</p>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-[#1CBF79] border-[#1CBF79]' : 'border-gray-500'
                            }`}>
                              {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Volume Sliders */}
                <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Customize Volume
                  </h3>

                  <div className="space-y-6">
                    {/* Content Pieces Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Content Pieces per Month</label>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">{contentPieces}</span>
                          <span className="text-sm text-gray-400">pieces</span>
                          <span className="text-sm font-bold text-[#1CBF79] ml-2">
                            ${(contentPieces * 150).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="40"
                        step="2"
                        value={contentPieces}
                        onChange={(e) => setContentPieces(Number(e.target.value))}
                        className="w-full h-2 bg-[#2A2A2D] rounded-lg appearance-none cursor-pointer accent-[#1CBF79]"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>4 pieces</span>
                        <span>40 pieces</span>
                      </div>
                    </div>

                    {/* Social Posts Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Social Media Posts per Month</label>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">{socialPosts}</span>
                          <span className="text-sm text-gray-400">posts</span>
                          <span className="text-sm font-bold text-blue-400 ml-2">
                            ${(socialPosts * 25).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="60"
                        step="5"
                        value={socialPosts}
                        onChange={(e) => setSocialPosts(Number(e.target.value))}
                        className="w-full h-2 bg-[#2A2A2D] rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>10 posts</span>
                        <span>60 posts</span>
                      </div>
                    </div>

                    {/* Ad Spend Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Monthly Ad Spend Budget</label>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">${adSpend.toLocaleString()}</span>
                          <span className="text-sm text-gray-400">budget</span>
                          <span className="text-sm font-bold text-purple-400 ml-2">
                            +${(adSpend * 0.15).toLocaleString()} fee
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="500"
                        max="10000"
                        step="500"
                        value={adSpend}
                        onChange={(e) => setAdSpend(Number(e.target.value))}
                        className="w-full h-2 bg-[#2A2A2D] rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>$500</span>
                        <span>$10,000</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Price Summary */}
              <div className="space-y-4">
                <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6 sticky top-6">
                  <h3 className="text-lg font-bold text-white mb-4">Investment Summary</h3>
                  
                  <div className="space-y-3 mb-6 pb-6 border-b border-[#2A2A2D]">
                    {selectedServices.map(serviceId => {
                      const service = serviceOptions.find(s => s.id === serviceId);
                      if (!service) return null;
                      return (
                        <div key={serviceId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">{service.name}</span>
                          <span className="text-white font-medium">${service.basePrice.toLocaleString()}</span>
                        </div>
                      );
                    })}
                    
                    {contentPieces > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{contentPieces} Content Pieces</span>
                        <span className="text-white font-medium">${(contentPieces * 150).toLocaleString()}</span>
                      </div>
                    )}
                    
                    {socialPosts > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{socialPosts} Social Posts</span>
                        <span className="text-white font-medium">${(socialPosts * 25).toLocaleString()}</span>
                      </div>
                    )}
                    
                    {adSpend > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Ad Management (15%)</span>
                        <span className="text-white font-medium">${(adSpend * 0.15).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-white font-medium">${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">GST (10%)</span>
                      <span className="text-white font-medium">${gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-[#1CBF79]/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 font-medium">Total Investment</span>
                      <span className="text-3xl font-bold text-[#1CBF79]">
                        ${calculatedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">per month, AUD</p>
                  </div>

                  <button 
                    onClick={() => setAccepted(true)}
                    className="w-full mt-6 py-3 bg-[#1CBF79] hover:bg-[#15a366] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept This Package
                  </button>

                  <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <p className="text-xs text-gray-400 text-center">
                      💡 <strong className="text-white">Pro Tip:</strong> Save 15% with annual payment
                    </p>
                  </div>
                </div>

                {/* Original Proposal Comparison */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-white mb-2">Original Proposal</h4>
                  <p className="text-2xl font-bold text-purple-400 mb-1">
                    ${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {calculatedTotal > sow.totalInvestment 
                      ? `+$${(calculatedTotal - sow.totalInvestment).toLocaleString('en-AU', { minimumFractionDigits: 2 })} more value` 
                      : `$${(sow.totalInvestment - calculatedTotal).toLocaleString('en-AU', { minimumFractionDigits: 2 })} savings`}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="bg-gradient-to-r from-[#1CBF79]/10 via-blue-500/10 to-purple-500/10 border border-[#2A2A2D] rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Ready to get started?</h3>
                  <p className="text-gray-400 text-sm">Your customized package is ready to launch in 14 days</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowChat(true)}
                    className="px-6 py-3 bg-[#0E0F0F] border border-[#2A2A2D] text-white rounded-lg hover:border-[#1CBF79] transition-colors"
                  >
                    Ask Questions
                  </button>
                  <button 
                    onClick={() => setAccepted(true)}
                    className="px-8 py-3 bg-[#1CBF79] hover:bg-[#15a366] text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept & Proceed
                  </button>
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