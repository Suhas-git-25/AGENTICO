import React, { useState, useEffect } from 'react';
import {
  Clock,
  Send,
  MessageSquare,
  Unlink,
  Activity,
  LogOut,
  ChevronDown,
  Mail,
  Plus,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui';
import { apiGet, apiDelete } from '../lib/api';
import { SlackStatus, ApiResponse } from '../lib/types';

export interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: 'scheduled' | 'sent' | 'queues';
  onTabChange: (tab: 'scheduled' | 'sent' | 'queues') => void;
  scheduledCount?: number;
  sentCount?: number;
  onComposeClick: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  scheduledCount = 0,
  sentCount = 0,
  onComposeClick,
}) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false, integration: null });
  const [isSlackLoading, setIsSlackLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchSlackStatus = async () => {
    try {
      const res = await apiGet<ApiResponse<SlackStatus> | SlackStatus>('/api/slack/status');
      if (res && 'connected' in res) {
        setSlackStatus(res as SlackStatus);
      } else if (res && 'data' in res && res.data) {
        setSlackStatus(res.data);
      }
    } catch {
      setSlackStatus({ connected: false, integration: null });
    }
  };

  useEffect(() => {
    fetchSlackStatus();

    const slackConnected = searchParams.get('slack_connected');
    const team = searchParams.get('team');
    const slackError = searchParams.get('slack_error');

    if (slackConnected) {
      showToast(`Slack connected to: ${team || 'Workspace'}!`, 'success');
      searchParams.delete('slack_connected');
      if (team) searchParams.delete('team');
      setSearchParams(searchParams, { replace: true });
      fetchSlackStatus();
    } else if (slackError) {
      showToast(`Slack connection issue: ${slackError}`, 'error');
      searchParams.delete('slack_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const handleConnectSlack = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    window.location.href = `${apiUrl}/api/slack/connect`;
  };

  const handleDisconnectSlack = async () => {
    setIsSlackLoading(true);
    try {
      await apiDelete('/api/slack/disconnect');
      setSlackStatus({ connected: false, integration: null });
      showToast('Slack workspace disconnected.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect Slack', 'error');
    } finally {
      setIsSlackLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Logged out successfully', 'info');
      navigate('/login');
    } catch (err: any) {
      showToast(err.message || 'Logout failed', 'error');
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'RI';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 flex selection:bg-[#00A859] selection:text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 min-w-[250px] border-r border-gray-200/80 p-5 flex flex-col justify-between h-screen sticky top-0 bg-white z-30">
        <div>
          {/* ReachInbox Brand Header */}
          <div className="flex items-center space-x-2.5 px-1 py-1">
            <div className="w-8 h-8 rounded-xl bg-[#00A859] flex items-center justify-center text-white shadow-sm shadow-[#00A859]/20">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold text-gray-900 tracking-tight">
                  ReachInbox
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#E8F8EE] text-[#00A859]">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Scheduler Engine</p>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="relative my-4">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full bg-[#F3F4F6]/80 hover:bg-[#EBEEF2] border border-gray-100 rounded-2xl p-2.5 flex items-center justify-between transition cursor-pointer text-left"
            >
              <div className="flex items-center space-x-2.5 overflow-hidden">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#00A859] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(user?.name, user?.email)}
                  </div>
                )}
                <div className="truncate">
                  <div className="text-xs font-bold text-gray-900 truncate">
                    {user?.name || 'Authenticated User'}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {user?.email || 'user@reachinbox.ai'}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in">
                <button
                  onClick={() => {
                    onTabChange('queues');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-[#F3F4F6] rounded-xl transition"
                >
                  <div className="flex items-center space-x-2">
                    <Activity className="w-3.5 h-3.5 text-[#00A859]" />
                    <span>BullMQ Analytics</span>
                  </div>
                </button>
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/admin/queues?token=admin-reachinbox-secret-token`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-[#F3F4F6] rounded-xl transition"
                >
                  <div className="flex items-center space-x-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Raw Bull Board</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Action Compose Button */}
          <button
            onClick={onComposeClick}
            className="w-full bg-[#00A859] hover:bg-[#00924D] text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer mb-5 shadow-sm shadow-[#00A859]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </button>

          {/* Navigation Section */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
              DISPATCH QUEUES
            </div>

            {/* Scheduled Nav Item */}
            <button
              onClick={() => onTabChange('scheduled')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-[#E8F8EE] text-[#00A859] font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-[#00A859]' : 'text-gray-400'}`} />
                <span>Scheduled</span>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                activeTab === 'scheduled' ? 'bg-[#00A859]/10 text-[#00A859]' : 'bg-gray-100 text-gray-500'
              }`}>
                {scheduledCount}
              </span>
            </button>

            {/* Sent Nav Item */}
            <button
              onClick={() => onTabChange('sent')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-[#E8F8EE] text-[#00A859] font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-[#00A859]' : 'text-gray-400'}`} />
                <span>Sent Deliveries</span>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                activeTab === 'sent' ? 'bg-[#00A859]/10 text-[#00A859]' : 'bg-gray-100 text-gray-500'
              }`}>
                {sentCount}
              </span>
            </button>

            {/* Live Queue Monitor Tab */}
            <button
              onClick={() => onTabChange('queues')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                activeTab === 'queues'
                  ? 'bg-[#E8F8EE] text-[#00A859] font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Activity className={`w-4 h-4 ${activeTab === 'queues' ? 'text-[#00A859]' : 'text-amber-500'}`} />
                <span>Live Queues</span>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Slack Alert Integration */}
        <div className="pt-3 border-t border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
            INTEGRATIONS
          </div>
          {slackStatus.connected ? (
            <div className="bg-[#E8F8EE] border border-[#CEEED8] p-2.5 rounded-xl text-xs text-[#00A859] flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <span className="w-2 h-2 rounded-full bg-[#00A859] shrink-0" />
                <div className="truncate">
                  <div className="font-semibold truncate text-[11px]">
                    Slack: {slackStatus.integration?.teamName}
                  </div>
                  <div className="text-[9px] text-gray-500">Rate limit alerts live</div>
                </div>
              </div>
              <button
                onClick={handleDisconnectSlack}
                disabled={isSlackLoading}
                className="text-gray-400 hover:text-rose-500 p-1 transition cursor-pointer"
                title="Disconnect Slack"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectSlack}
              className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-gray-700 font-medium py-2 px-3 rounded-xl text-xs transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#00A859]" />
                <span>Connect Slack</span>
              </div>
              <Plus className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]">
        {children}
      </main>
    </div>
  );
};
