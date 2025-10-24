"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Sparkles, Download, CheckCircle, MessageCircle, ArrowLeft, 
  FileText, DollarSign, Calendar, Eye, Share2, Clock,
  Target, TrendingUp, Users, Zap, Home, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/tailwind/ui/button';
import { toast } from 'sonner';
import { exportToExcel, extractPricingFromHTML } from '@/lib/export-utils';
import { SocialGardenHeader } from '@/components/header/sg-header';

interface SOWData {
  id: string;
  title: string;
  clientName: string;
  htmlContent: string;
  totalInvestment: number;
  createdAt: string;
  workspaceSlug: string;
  embedId?: string;
  vertical?: string;
  serviceLine?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Pricing display controls
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [hideGrandTotal, setHideGrandTotal] = useState<boolean>(false);
  const [budgetAdjustmentNotes, setBudgetAdjustmentNotes] = useState<string>('');
  
  // Interactive Pricing Calculator
  const [selectedServices, setSelectedServices] = useState<string[]>(['social-media', 'content-creation']);
  const [contentPieces, setContentPieces] = useState<number>(12);
  const [socialPosts, setSocialPosts] = useState<number>(20);
  const [adSpend, setAdSpend] = useState<number>(2000);
  const [dynamicServices, setDynamicServices] = useState<PricingOption[]>([]);

  // AI-Recommended Add-Ons
  interface Recommendation {
    id: number;
    service_id: string;
    service_name: string;
    service_description: string;
    recommended_price: number;
    pricing_unit: string;
    category: string;
    ai_reasoning: string;
    relevance_score: number;
    is_selected: boolean;
  }
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<number[]>([]);

  // Calculate total investment (for accept handler and display)
  const calculatedTotal = useMemo(() => {
    const serviceOptions = dynamicServices.length > 0 ? dynamicServices : [
      { id: 'social-media', name: 'Social Media Management', basePrice: 1500, description: '', icon: Users },
      { id: 'content-creation', name: 'Content Creation', basePrice: 2000, description: '', icon: FileText },
      { id: 'paid-ads', name: 'Paid Advertising', basePrice: 1200, description: '', icon: Target },
      { id: 'seo', name: 'SEO Optimization', basePrice: 1800, description: '', icon: TrendingUp },
      { id: 'analytics', name: 'Analytics & Reporting', basePrice: 800, description: '', icon: Eye }
    ];
    
    const baseServicesTotal = serviceOptions
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + s.basePrice, 0);
    
    const contentCost = contentPieces * 150;
    const socialCost = socialPosts * 25;
    const adManagementFee = adSpend * 0.15;
    const addOnsTotal = recommendations
      .filter(r => selectedAddOns.includes(r.id))
      .reduce((sum, r) => sum + r.recommended_price, 0);
    
    const subtotal = baseServicesTotal + contentCost + socialCost + adManagementFee + addOnsTotal;
    const gst = subtotal * 0.1;
    return subtotal + gst;
  }, [selectedServices, contentPieces, socialPosts, adSpend, dynamicServices, recommendations, selectedAddOns]);

  useEffect(() => {
    // Load SOW data
    loadSOW();
    // Load AI recommendations
    loadRecommendations();
  }, [sowId]);

  // 🔥 SWITCHED TO OPENROUTER - Direct AI chat without document embedding
  // AnythingLLM was showing "no relevant information" because workspace was empty
  // OpenRouter gives instant responses about SOW content without needing RAG
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Load dynamic services from admin panel
  useEffect(() => {
    const loadDynamicServices = async () => {
      try {
        const response = await fetch('/api/admin/services');
        const data = await response.json();
        
        if (data.success && data.services) {
          const activeServices = data.services
            .filter((s: any) => s.is_active)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              basePrice: parseFloat(s.base_price),
              description: s.description,
              icon: Target, // Default icon
            }));
          
          setDynamicServices(activeServices);
          console.log('✅ Loaded', activeServices.length, 'services from admin panel');
        }
      } catch (error) {
        console.error('Error loading dynamic services:', error);
      }
    };

    loadDynamicServices();
  }, []);

  const loadSOW = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch SOW from database API
      const response = await fetch(`/api/sow/${sowId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('This proposal could not be found. It may have been removed or the link is incorrect.');
        } else {
          setError(`Failed to load proposal: ${response.statusText}`);
        }
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (!data.sow) {
        setError('No proposal data found.');
        setLoading(false);
        return;
      }
      
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
          embedId,
          vertical: sowData.vertical,
          serviceLine: sowData.service_line,
        });
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading SOW:', error);
      setError('An unexpected error occurred while loading the proposal.');
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await fetch(`/api/sow/${sowId}/recommendations`);
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        // Pre-select previously selected add-ons
        const preSelected = data.recommendations
          .filter((r: Recommendation) => r.is_selected)
          .map((r: Recommendation) => r.id);
        setSelectedAddOns(preSelected);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const handleAcceptSOW = async () => {
    if (!sow) return;
    
    try {
      const response = await fetch(`/api/sow/${sowId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: sow.clientName,
          totalInvestment: calculatedTotal,
          selectedServices,
          addOns: selectedAddOns,
          discountPercent,
          budgetAdjustmentNotes,
        }),
      });

      if (response.ok) {
        setAccepted(true);
        toast.success('🎉 Proposal accepted! We\'ll be in touch shortly to get started.');
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to accept proposal. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting proposal:', error);
      toast.error('Failed to accept proposal. Please contact us directly.');
    }
  };

  const handleToggleAddOn = async (recommendationId: number) => {
    const isSelected = selectedAddOns.includes(recommendationId);
    const newSelection = isSelected
      ? selectedAddOns.filter(id => id !== recommendationId)
      : [...selectedAddOns, recommendationId];
    
    setSelectedAddOns(newSelection);

    // Update database
    try {
      await fetch(`/api/sow/${sowId}/recommendations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationIds: [recommendationId],
          isSelected: !isSelected,
        }),
      });
    } catch (error) {
      console.error('Error updating recommendation:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!sow) return;
    
    try {
      // Trigger PDF download via GET request
      const response = await fetch(`/api/generate-pdf?sowId=${sowId}`);
      
      if (!response.ok) {
        console.error('Failed to generate PDF:', response.statusText);
        toast.error('Failed to download PDF. Please try again.');
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
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const handleDownloadExcel = async () => {
    if (!sow) return;
    try {
      const pricingRows = extractPricingFromHTML(sow.htmlContent);
      if (pricingRows.length === 0) {
        console.warn('No pricing rows detected in HTML; proceeding with empty pricing.');
      }
      await exportToExcel({
        title: sow.title,
        client: sow.clientName,
        pricingRows,
      });
      toast.success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file. Please try again.');
    }
  };

  // Calculate totals for Excel export (same as pricing display)
  const baseServicesTotal = useMemo(() => {
    const serviceOptions = dynamicServices.length > 0 ? dynamicServices : [
      { id: 'social-media', name: 'Social Media Management', basePrice: 1500, description: '', icon: Users },
      { id: 'content-creation', name: 'Content Creation', basePrice: 2000, description: '', icon: FileText },
      { id: 'paid-ads', name: 'Paid Advertising', basePrice: 1200, description: '', icon: Target },
      { id: 'seo', name: 'SEO Optimization', basePrice: 1800, description: '', icon: TrendingUp },
      { id: 'analytics', name: 'Analytics & Reporting', basePrice: 800, description: '', icon: Eye }
    ];
    return serviceOptions
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + s.basePrice, 0);
  }, [selectedServices, dynamicServices]);

  const contentCost = contentPieces * 150;
  const socialCost = socialPosts * 25;
  const adManagementFee = adSpend * 0.15;
  const addOnsTotal = recommendations
    .filter(r => selectedAddOns.includes(r.id))
    .reduce((sum, r) => sum + r.recommended_price, 0);

  const subtotal = baseServicesTotal + contentCost + socialCost + adManagementFee + addOnsTotal;
  const gst = subtotal * 0.1;
  const discountAmount = (subtotal + gst) * (discountPercent / 100);
  const grandTotalBeforeRounding = (subtotal + gst) - discountAmount;
  // Round to nearest $5,000
  const grandTotal = Math.round(grandTotalBeforeRounding / 5000) * 5000;

  // 🔥 SEND QUICK QUESTION - For preset buttons
  const sendQuickQuestion = useCallback(async (question: string) => {
    if (!sow) return;
    
    try {
      setIsChatLoading(true);
      
      // Add user message to chat
      const newMessages = [
        ...chatMessages,
        { role: 'user' as const, content: question }
      ];
      setChatMessages(newMessages);
      
      try {
        // Call OpenRouter API with SOW context
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [
              {
                role: 'system',
                content: `You are the Social Garden AI Assistant for ${sow.clientName}'s proposal.

**Your SOW Document:**
${sow.htmlContent}

**Key Details:**
- Client: ${sow.clientName}
- Total Investment: $${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
- Title: ${sow.title}

**Instructions:**
- Answer questions about this specific SOW
- Be professional, friendly, and helpful
- Cite specific details from the SOW when relevant
- If asked about pricing, deliverables, or timeline, extract from the SOW content above
- Keep responses concise and clear`
              },
              ...newMessages
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;
        
        setChatMessages([
          ...newMessages,
          { role: 'assistant' as const, content: assistantMessage }
        ]);
      } catch (error) {
        console.error('Error sending chat message:', error);
        toast.error('Failed to get AI response. Please try again.');
        setChatMessages([
          ...newMessages,
          { role: 'assistant' as const, content: 'Sorry, I encountered an error. Please try again.' }
        ]);
      } finally {
        setIsChatLoading(false);
      }
    } catch (outerError) {
      console.error('Outer error in sendQuickQuestion:', outerError);
      setIsChatLoading(false);
    }
  }, [sow, chatMessages]);

  // 🔥 OPENROUTER CHAT HANDLER - Direct AI without RAG
  const handleSendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !sow) return;
    
    try {
      const userMessage = chatInput.trim();
      setChatInput('');
      setIsChatLoading(true);
      
      // Add user message to chat
      const newMessages = [
        ...chatMessages,
        { role: 'user' as const, content: userMessage }
      ];
      setChatMessages(newMessages);
      
      try {
        // Call OpenRouter API with SOW context
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free', // 🆓 FREE on OpenRouter!
            messages: [
              {
                role: 'system',
                content: `You are the Social Garden AI Assistant for ${sow.clientName}'s proposal.

**Your SOW Document:**
${sow.htmlContent}

**Key Details:**
- Client: ${sow.clientName}
- Total Investment: $${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
- Title: ${sow.title}

**Instructions:**
- Answer questions about this specific SOW
- Be professional, friendly, and helpful
- Cite specific details from the SOW when relevant
- If asked about pricing, deliverables, or timeline, extract from the SOW content above
- Keep responses concise and clear`
              },
              ...newMessages
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;
        
        setChatMessages([
          ...newMessages,
          { role: 'assistant' as const, content: assistantMessage }
        ]);
      } catch (error) {
        console.error('Error sending chat message:', error);
        toast.error('Failed to get AI response. Please try again.');
        setChatMessages([
          ...newMessages,
          { role: 'assistant' as const, content: 'Sorry, I encountered an error. Please try again.' }
        ]);
      } finally {
        setIsChatLoading(false);
      }
    } catch (outerError) {
      console.error('Outer error in handleSendChatMessage:', outerError);
      setIsChatLoading(false);
    }
  }, [chatInput, sow, chatMessages]);

  // 🔥 RENDER TAB CONTENT - Memoized
  const renderTabContent = useCallback(() => {
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
                    <span className="text-sm font-medium text-gray-200">Total Investment</span>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">
                    ${(sow.totalInvestment || calculatedTotal).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-400">AUD (inc. GST)</p>
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
                  prose-table:w-full prose-table:border-collapse prose-table:my-8 prose-table:bg-[#0E0F0F] prose-table:table-fixed
                  prose-thead:border-b-2 prose-thead:border-[#1CBF79]/50
                  prose-th:bg-[#1A1A1D] prose-th:text-white prose-th:font-bold prose-th:p-4 prose-th:text-left prose-th:border prose-th:border-[#2A2A2D] prose-th:break-words
                  prose-tbody:bg-[#0E0F0F]
                  prose-td:bg-[#0E0F0F] prose-td:border prose-td:border-[#2A2A2D] prose-td:text-gray-200 prose-td:p-4 prose-td:break-words prose-td:overflow-wrap-anywhere
                  prose-tr:border-b prose-tr:border-[#2A2A2D]
                  prose-tr:hover:bg-[#1CBF79]/10 prose-tr:transition-colors"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
            </div>
          </div>
        );

      case 'pricing':
        // Load services from admin panel (will be populated via useEffect)
        const serviceOptions: PricingOption[] = dynamicServices.length > 0 ? dynamicServices : [
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
        
        // Add-ons total (AI-recommended services)
        const addOnsTotal = recommendations
          .filter(r => selectedAddOns.includes(r.id))
          .reduce((sum, r) => sum + r.recommended_price, 0);
        
  // Calculate subtotal and GST for display (total comes from useMemo)
  const subtotal = baseServicesTotal + contentCost + socialCost + adManagementFee + addOnsTotal;
  const gst = subtotal * 0.1;
  const discountAmount = (subtotal + gst) * (discountPercent / 100);
  const grandTotal = (subtotal + gst) - discountAmount;
        
        const toggleService = (serviceId: string) => {
          if (selectedServices.includes(serviceId)) {
            setSelectedServices(selectedServices.filter(id => id !== serviceId));
          } else {
            setSelectedServices([...selectedServices, serviceId]);
          }
        };

        return (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* 🔥 ACTUAL SOW PRICING (from document) */}
            <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[#1CBF79]/20 rounded-xl">
                  <FileText className="w-8 h-8 text-[#1CBF79]" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">Proposed Investment</h2>
                  <p className="text-gray-400">As outlined in your Statement of Work</p>
                </div>
              </div>
              
              {/* Display pricing table from HTML content */}
              <div 
                className="prose prose-invert prose-lg max-w-none 
                  prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-table:bg-[#0E0F0F] prose-table:table-fixed
                  prose-thead:border-b-2 prose-thead:border-[#1CBF79]/50
                  prose-th:bg-[#1A1A1D] prose-th:text-white prose-th:font-bold prose-th:p-4 prose-th:text-left prose-th:border prose-th:border-[#2A2A2D] prose-th:break-words
                  prose-tbody:bg-[#0E0F0F]
                  prose-td:bg-[#0E0F0F] prose-td:border prose-td:border-[#2A2A2D] prose-td:text-gray-200 prose-td:p-4 prose-td:break-words prose-td:overflow-wrap-anywhere
                  prose-tr:border-b prose-tr:border-[#2A2A2D]
                  prose-tr:hover:bg-[#1CBF79]/10 prose-tr:transition-colors"
                dangerouslySetInnerHTML={{ __html: sow.htmlContent }}
              />
              
              <div className="mt-6 p-6 bg-gradient-to-r from-[#1CBF79]/10 to-blue-500/10 border border-[#1CBF79]/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Investment</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-bold text-[#1CBF79]">
                        ${sow.totalInvestment.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-xs text-gray-400 font-medium">+ GST</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleAcceptSOW}
                    className="bg-[#1CBF79] hover:bg-[#15965E] text-white px-8 py-6 text-lg font-bold shadow-lg shadow-[#1CBF79]/20"
                  >
                    <CheckCircle className="w-6 h-6 mr-2" />
                    Accept This Proposal
                  </Button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#2A2A2D] to-transparent"></div>
              <span className="text-gray-500 text-sm font-medium">OR EXPLORE CUSTOMIZATION</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#2A2A2D] to-transparent"></div>
            </div>

            {/* Interactive Calculator Header */}
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">Build Your Own Package</h2>
                    <p className="text-gray-400">Adjust services and volume to fit your needs</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Calculated Total</p>
                  <p className="text-4xl font-bold text-blue-400">
                    ${calculatedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Left Column: Service Selection */}
              <div className="col-span-2 space-y-4">
                {/* Discount & Display Controls */}
                <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#1CBF79]" />
                    Pricing Controls
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Discount (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Number(e.target.value))}
                          className="w-full h-2 bg-[#2A2A2D] rounded-lg appearance-none cursor-pointer accent-[#1CBF79]"
                        />
                        <span className="text-white font-semibold w-12 text-right">{discountPercent}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Hide Grand Total</label>
                      <button
                        onClick={() => setHideGrandTotal(!hideGrandTotal)}
                        className={`inline-flex items-center px-3 py-2 rounded-lg border-2 transition-all ${hideGrandTotal ? 'border-[#1CBF79] bg-[#1CBF79]/10 text-[#1CBF79]' : 'border-[#2A2A2D] text-gray-300 hover:border-[#1CBF79]/50'}`}
                      >
                        {hideGrandTotal ? 'Hidden' : 'Shown'}
                      </button>
                    </div>
                  </div>
                </div>
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
                    
                    {/* Show selected add-ons in summary */}
                    {selectedAddOns.length > 0 && recommendations.filter(r => selectedAddOns.includes(r.id)).map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between text-sm border-t border-purple-500/30 pt-3 mt-3">
                        <span className="text-purple-300 flex items-center gap-2">
                          <Sparkles className="w-3 h-3" />
                          {rec.service_name}
                        </span>
                        <span className="text-purple-300 font-medium">${rec.recommended_price.toLocaleString()}</span>
                      </div>
                    ))}
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
                    {discountPercent > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Discount ({discountPercent}%)</span>
                        <span className="text-white font-medium">- ${discountAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>

                  {!hideGrandTotal && (
                    <div className="pt-4 border-t-2 border-[#1CBF79]/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 font-medium">Grand Total (AUD)</span>
                        <span className="text-3xl font-bold text-[#1CBF79]">
                          ${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Rounded to nearest $5,000. Includes GST and any applied discount.</p>
                    </div>
                  )}

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

            {/* AI-Recommended Add-Ons Section */}
            {recommendations.length > 0 && (
              <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 border-2 border-purple-500/30 rounded-2xl p-8 mt-12">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Recommended Add-Ons for You
                    </h3>
                    <p className="text-gray-400">
                      Based on AI analysis of your business, these services could significantly boost your results
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {recommendations.map((rec) => {
                    const isSelected = selectedAddOns.includes(rec.id);
                    return (
                      <div
                        key={rec.id}
                        className={`
                          bg-[#1A1A1D] border-2 rounded-xl p-6 transition-all cursor-pointer
                          ${isSelected 
                            ? 'border-[#1CBF79] bg-[#1CBF79]/5' 
                            : 'border-[#2A2A2D] hover:border-purple-500/50'
                          }
                        `}
                        onClick={() => handleToggleAddOn(rec.id)}
                      >
                        <div className="flex items-start justify-between gap-6">
                          {/* Left: Checkbox + Service Info */}
                          <div className="flex items-start gap-4 flex-1">
                            {/* Checkbox */}
                            <div 
                              className={`
                                w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-1
                                transition-all
                                ${isSelected 
                                  ? 'bg-[#1CBF79] border-[#1CBF79]' 
                                  : 'border-[#2A2A2D] hover:border-purple-500/50'
                                }
                              `}
                            >
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Service Details */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-lg font-bold text-white">{rec.service_name}</h4>
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded font-medium">
                                  {(rec.relevance_score * 100).toFixed(0)}% match
                                </span>
                              </div>

                              <p className="text-sm text-gray-400 mb-3">
                                {rec.service_description}
                              </p>

                              {/* AI Reasoning */}
                              <div className="bg-[#0E0F0F] border border-[#2A2A2D] rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-purple-400 mb-1 uppercase tracking-wider">
                                      Why this matters for you
                                    </p>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                      {rec.ai_reasoning}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: Pricing */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-[#1CBF79]">
                              ${rec.recommended_price.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">per {rec.pricing_unit}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add-Ons Summary */}
                {selectedAddOns.length > 0 && (
                  <div className="mt-6 bg-[#0E0F0F] border border-[#2A2A2D] rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-1">
                          Selected Add-Ons ({selectedAddOns.length})
                        </h4>
                        <p className="text-xs text-gray-400">These will be added to your total investment</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-400">
                          +${addOnsTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">additional per month</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowChat(true)}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Request Custom Quote for Selected Add-Ons
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom CTA */}
            <div className="bg-gradient-to-r from-[#1CBF79]/10 via-blue-500/10 to-purple-500/10 border border-[#2A2A2D] rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Ready to get started?</h3>
                  <p className="text-gray-400 text-sm">Your customized package is ready to launch in 14 days</p>
                  <div className="mt-4">
                    <label className="block text-sm text-gray-300 mb-2">Budget Adjustment Notes (optional)</label>
                    <textarea
                      value={budgetAdjustmentNotes}
                      onChange={(e) => setBudgetAdjustmentNotes(e.target.value)}
                      placeholder="Document changes to modules or hours made to meet budget constraints (internal note)"
                      className="w-full bg-[#0E0F0F] border border-[#2A2A2D] rounded-lg p-3 text-sm text-gray-200 placeholder:text-gray-500"
                      rows={3}
                    />
                  </div>
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
  }, [sow, activeTab, dynamicServices, selectedServices, contentPieces, socialPosts, adSpend, selectedAddOns, recommendations, accepted, calculatedTotal]);
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0F0F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1CBF79] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !sow) {
    return (
      <div className="min-h-screen bg-[#0E0F0F] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Proposal Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error || "This proposal doesn't exist or has been removed."}
          </p>
          <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-2">Need help?</p>
            <p className="text-xs text-gray-500">
              Contact your account manager or email{' '}
              <a href="mailto:hello@socialgarden.com.au" className="text-[#1CBF79] hover:underline">
                hello@socialgarden.com.au
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SocialGardenHeader />
      <div className="min-h-screen bg-[#0E0F0F] flex relative">
      {/* 🔥 SIDEBAR NAVIGATION - Like main app */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-[#1A1A1D] border-r border-[#2A2A2D] flex flex-col overflow-hidden`}>
        {/* Logo Header */}
        <div className="p-6 border-b border-[#2A2A2D]">
          <div className="flex items-center gap-3">
            <img 
              src="/images/logo-light.png" 
              alt="Social Garden" 
              className="h-10 w-auto"
            />
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

          <Button
            onClick={handleDownloadExcel}
            variant="outline"
            className="w-full gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D] hover:text-white"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel
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

      {/* 🔥 MAIN CONTENT AREA - Adjust width when chat is open */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${showChat ? 'mr-[450px]' : 'mr-0'}`}>
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
                onClick={handleDownloadPDF}
                variant="outline"
                size="sm"
                className="gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D] hover:border-[#1CBF79]"
              >
                <Download className="w-4 h-4" />
                PDF
              </Button>

              <Button
                onClick={handleDownloadExcel}
                variant="outline"
                size="sm"
                className="gap-2 border-gray-600 text-gray-300 hover:bg-[#2A2A2D] hover:border-blue-500"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>

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

      {/* 🔥 AI CHAT PANEL - Responsive sidebar (no overlay on desktop) */}
      <aside 
        className={`fixed right-0 top-0 bottom-0 bg-[#1A1A1D] border-l border-[#2A2A2D] flex flex-col shadow-2xl transition-all duration-300 z-50 ${
          showChat ? 'w-[450px]' : 'w-0'
        } overflow-hidden`}
      >
        {/* Chat Header */}
        <div className="p-6 border-b border-[#2A2A2D] bg-gradient-to-r from-[#1CBF79]/10 to-[#15965E]/10 flex-shrink-0">
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

        {/* Chat Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0E0F0F] space-y-4">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#1CBF79]/30">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">AI Assistant Ready!</p>
              <p className="text-sm text-gray-400 mb-6">Ask me anything about your proposal</p>
              <div className="space-y-2 w-full max-w-xs">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Try asking:</p>
                <div className="text-left space-y-1 text-sm text-gray-400">
                  <p>• "What's the total investment?"</p>
                  <p>• "What deliverables are included?"</p>
                  <p>• "When does the project start?"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-[#1CBF79] text-white'
                        : 'bg-[#1A1A1D] text-gray-200 border border-[#2A2A2D]'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">You</span>
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#1CBF79] to-[#15965E] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-[#1CBF79] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggested Questions + Text Input */}
        <div className="border-t border-[#2A2A2D] bg-[#1A1A1D] flex-shrink-0">
          <div className="p-4">
            {chatMessages.length === 0 && (
              <>
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Quick Questions</p>
                <div className="space-y-2 mb-4">
                  {[
                    { icon: DollarSign, text: "What's the total investment?" },
                    { icon: Clock, text: "Timeline for deliverables?" },
                    { icon: FileText, text: "What's included in the scope?" },
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        // Send message directly without setting input state first
                        sendQuickQuestion(q.text);
                      }}
                      className="w-full text-left text-xs p-2 rounded-lg bg-[#2A2A2D] hover:bg-[#3A3A3D] text-gray-300 transition-all border border-gray-700 hover:border-[#1CBF79] flex items-center gap-2 group"
                    >
                      <q.icon className="w-3 h-3 text-gray-500 group-hover:text-[#1CBF79] transition-colors" />
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            
            {/* Text Input Field */}
            <div className="relative">
              <input
                type="text"
                placeholder="Type your question here..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-[#0E0F0F] border border-[#2A2A2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#1CBF79] transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={isChatLoading}
              />
              <button 
                onClick={handleSendChatMessage}
                disabled={isChatLoading || !chatInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#1CBF79] hover:bg-[#15a366] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
      
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
    </>
  );

}