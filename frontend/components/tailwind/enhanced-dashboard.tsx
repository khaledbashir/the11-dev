"use client";

import { useEffect, useState } from 'react';

import { 
  TrendingUp, 
  FileText, 
  DollarSign, 
  Clock, 
  Users,
  MessageSquare,
  RefreshCw,
  Send,
  Loader2,
  BarChart3,
  Calendar,
  Target,
  Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { formatInvestment } from '@/lib/sow-utils';
import { StreamingThoughtAccordion } from './streaming-thought-accordion';

interface DashboardStats {
  totalSOWs: number;
  totalValue: number;
  activeSOWs: number;
  thisMonthSOWs: number;
  recentActivity: Array<{
    clientName: string;
    sowTitle: string;
    value: number;
    date: string;
  }>;
  topClients: Array<{
    name: string;
    totalValue: number;
    sowCount: number;
  }>;
  popularServices: Array<{
    service: string;
    count: number;
    percentage: number;
  }>;
  isEmpty?: boolean;
  message?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function EnhancedDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    // Add welcome message
    setChatMessages([{
      role: 'assistant',
      content: '👋 Hi! I\'m your Dashboard AI. Ask me anything about your SOWs:\n\n• "How many proposals this month?"\n• "Show total revenue"\n• "List top clients"\n• "What services are most popular?"',
      timestamp: new Date().toISOString()
    }]);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Fetch from database API (no artificial timeout - let browser handle it)
      const response = await fetch('/api/dashboard/stats', {
        // Removed AbortController timeout - browser has its own timeout
        // This prevents premature aborts during slow database queries
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
    } catch (err: any) {
      console.error('❌ Dashboard failed to load:', err);
      const errorMessage = err.name === 'AbortError' 
        ? 'Dashboard request was cancelled. Please try again.' 
        : err.message || 'Failed to load dashboard data';
      setError(errorMessage);
      setStats({
        totalSOWs: 0,
        totalValue: 0,
        activeSOWs: 0,
        thisMonthSOWs: 0,
        recentActivity: [],
        topClients: [],
        popularServices: [],
        isEmpty: true,
        message: 'Error loading dashboard'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      // AI Chat feature temporarily disabled
      // TODO: Implement proper thread creation before sending chat messages
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: 'Dashboard AI is currently under maintenance. Please check back soon!',
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0e0f0f]">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0e0f0f]">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Dashboard Failed to Load</h2>
          <p className="text-gray-400 mb-4">
            {error || 'Unable to fetch dashboard statistics'}
          </p>
          <Button onClick={fetchDashboardStats} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0e0f0f]">
      {/* Main Dashboard - Reduced left padding to eliminate gap */}
      <div className="flex-1 overflow-auto py-6 pr-6 pl-2">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">📊 SOW Dashboard</h1>
            <p className="text-gray-400 mt-1">Real-time analytics powered by AI</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchDashboardStats}
              variant="outline"
              className="border-[#1CBF79] text-[#1CBF79] hover:bg-[#1CBF79]/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {stats.totalSOWs === 0 && (
          <div className="bg-gradient-to-br from-[#0e2e33] to-[#1b1b1e] border border-[#20e28f]/30 rounded-xl p-8 mb-6 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold text-white mb-2">Dashboard Ready!</h3>
            <p className="text-gray-300 mb-4 max-w-2xl mx-auto">
              Your dashboard is ready. Create your first Workspace and add an SOW to begin seeing your analytics.
            </p>
            {/* Removed the ambiguous error message - the dashboard is ready, just empty */}
          </div>
        )}

        {/* Key Metrics - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={<FileText className="w-6 h-6" />}
            label="Total SOWs"
            value={stats.totalSOWs}
            color="from-blue-500 to-blue-600"
            iconBg="bg-[#1CBF79]/20"
            iconColor="text-[#1CBF79]"
          />
          <MetricCard
            icon={<DollarSign className="w-6 h-6" />}
            label="Total Value"
            value={formatInvestment(stats.totalValue)}
            subValue="+GST"
            color="from-emerald-500 to-emerald-600"
            iconBg="bg-[#1CBF79]/20"
            iconColor="text-[#1CBF79]"
          />
          <MetricCard
            icon={<Clock className="w-6 h-6" />}
            label="Active Proposals"
            value={stats.activeSOWs}
            color="from-yellow-500 to-yellow-600"
            iconBg="bg-[#1CBF79]/20"
            iconColor="text-[#1CBF79]"
          />
          <MetricCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="This Month"
            value={stats.thisMonthSOWs}
            color="from-purple-500 to-purple-600"
            iconBg="bg-[#1CBF79]/20"
            iconColor="text-[#1CBF79]"
          />
        </div>

        {/* Content Grid - Show only if we have data */}
        {stats.totalSOWs > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="bg-[#1b1b1e] border border-[#0e2e33] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              </div>
              <div className="space-y-4">
                {stats.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity, idx) => (
                    <div key={idx} className="bg-[#0e0f0f] border border-[#0e2e33] rounded-lg p-4 hover:border-blue-400/50 transition-colors">
                      <div className="font-semibold text-white">{activity.clientName}</div>
                      <div className="text-sm text-gray-400 mt-1">{activity.sowTitle}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-emerald-400 font-bold">
                          {formatInvestment(activity.value)}
                        </span>
                        <span className="text-xs text-gray-500">{activity.date}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">No recent activity</p>
                )}
              </div>
            </div>

            {/* Top Clients */}
            <div className="bg-[#1b1b1e] border border-[#0e2e33] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Top Clients</h2>
              </div>
              <div className="space-y-3">
                {stats.topClients && stats.topClients.length > 0 ? (
                  stats.topClients.map((client, idx) => (
                    <div key={idx} className="bg-[#0e0f0f] border border-[#0e2e33] rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-white">{client.name}</div>
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                          {client.sowCount} SOW{client.sowCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-emerald-400">
                        {formatInvestment(client.totalValue)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">No client data</p>
                )}
              </div>
            </div>

            {/* Popular Services */}
            <div className="bg-[#1b1b1e] border border-[#0e2e33] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Popular Services</h2>
              </div>
              <div className="space-y-3">
                {stats.popularServices && stats.popularServices.length > 0 ? (
                  stats.popularServices.map((service, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white font-medium">{service.service}</span>
                        <span className="text-gray-400">{service.count}x</span>
                      </div>
                      <div className="w-full bg-[#0e0f0f] rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${service.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">No service data</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat Sidebar - Right Side (FIXED HEIGHT WITH SCROLL) */}
      {showChat && (
        <div className="w-[420px] border-l border-[#0e2e33] bg-[#1b1b1e] flex flex-col h-screen">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#0e2e33] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Dashboard AI Assistant</h3>
                  <p className="text-xs text-gray-400">Analyze your SOW data</p>
                </div>
              </div>
            </div>
            
            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
              <strong>💡 Tips:</strong> Ask about totals, trends, clients, or services
            </div>
          </div>

          {/* Chat Messages - FIXED HEIGHT WITH SCROLL */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-2 flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0e0f0f] border border-[#0e2e33] text-gray-200'
                  }`}
                >
                  {/* Show thinking section with accordion for assistant messages */}
                  {msg.role === 'assistant' && (
                    <div className="mb-3">
                      <StreamingThoughtAccordion 
                        content={msg.content}
                        messageId={msg.id}
                        isStreaming={false}
                      />
                    </div>
                  )}
                  
                  {/* Show actual content */}
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '')}
                  </div>
                  <div className="text-xs opacity-50 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center ml-2 flex-shrink-0">
                    <span className="text-sm font-bold text-blue-400">You</span>
                  </div>
                )}
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-[#0e0f0f] border border-[#0e2e33] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - FIXED AT BOTTOM */}
          <div className="p-4 border-t border-[#0e2e33] flex-shrink-0 bg-[#1b1b1e]">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="Ask about your SOWs..."
                disabled={chatLoading}
                className="bg-[#0e0f0f] border-[#0e2e33] text-white placeholder:text-gray-500 focus:border-emerald-500"
              />
              <Button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#1CBF79] hover:bg-[#15a366] flex-shrink-0"
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon,
  label,
  value,
  subValue,
  color,
  iconBg,
  iconColor
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[#1b1b1e] border border-[#0e2e33] rounded-xl p-6 hover:border-[#20e28f]/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        {value}
        {subValue && <span className="text-sm text-gray-400 ml-2">{subValue}</span>}
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
