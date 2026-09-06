import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Zap,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ComposeEmailModal } from '../components/ComposeEmailModal';
import { LiveQueueDashboard } from '../components/LiveQueueDashboard';
import { Badge, Spinner, EmptyState, useToast, Modal } from '../components/ui';
import { apiGet } from '../lib/api';
import { ScheduledEmail, PaginatedResponse } from '../lib/types';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queues'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);

  // Filter dropdown state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Scheduled data
  const [scheduledList, setScheduledList] = useState<ScheduledEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [isScheduledLoading, setIsScheduledLoading] = useState(true);

  // Sent data
  const [sentList, setSentList] = useState<ScheduledEmail[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [isSentLoading, setIsSentLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ScheduledEmail[] | null>(null);

  const PAGE_SIZE = 12;

  const fetchScheduledEmails = useCallback(
    async (page = scheduledPage, silent = false) => {
      if (!silent) setIsScheduledLoading(true);
      try {
        const res = await apiGet<PaginatedResponse<ScheduledEmail>>(
          `/api/emails/scheduled?page=${page}&pageSize=${PAGE_SIZE}`
        );
        if (res && res.data) {
          setScheduledList(res.data);
          setScheduledTotal(res.total || 0);
        }
      } catch (err: any) {
        if (!silent) showToast(err.message || 'Failed to fetch scheduled emails', 'error');
      } finally {
        if (!silent) setIsScheduledLoading(false);
      }
    },
    [scheduledPage, showToast]
  );

  const fetchSentEmails = useCallback(
    async (page = sentPage, silent = false) => {
      if (!silent) setIsSentLoading(true);
      try {
        const res = await apiGet<PaginatedResponse<ScheduledEmail>>(
          `/api/emails/sent?page=${page}&pageSize=${PAGE_SIZE}`
        );
        if (res && res.data) {
          setSentList(res.data);
          setSentTotal(res.total || 0);
        }
      } catch (err: any) {
        if (!silent) showToast(err.message || 'Failed to fetch sent emails', 'error');
      } finally {
        if (!silent) setIsSentLoading(false);
      }
    },
    [sentPage, showToast]
  );

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiGet<{ success: boolean; data: ScheduledEmail[] }>(
        `/api/emails/search?q=${encodeURIComponent(query.trim())}`
      );
      if (res && res.data) {
        setSearchResults(res.data);
      }
    } catch {
      const queryLower = query.toLowerCase();
      const currentList = activeTab === 'scheduled' ? scheduledList : sentList;
      setSearchResults(
        currentList.filter(
          (e) =>
            e.toEmail.toLowerCase().includes(queryLower) ||
            e.subject.toLowerCase().includes(queryLower) ||
            e.body.toLowerCase().includes(queryLower)
        )
      );
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchScheduledEmails(1);
    fetchSentEmails(1);
  }, []);

  // Polling every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isComposeOpen && !selectedEmail && !searchQuery) {
        fetchScheduledEmails(scheduledPage, true);
        fetchSentEmails(sentPage, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, scheduledPage, sentPage, isComposeOpen, selectedEmail, searchQuery]);

  const handleRefresh = () => {
    if (activeTab === 'scheduled') {
      fetchScheduledEmails(scheduledPage);
    } else {
      fetchSentEmails(sentPage);
    }
    showToast('Updated email records', 'info');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Filter items
  const filterList = (items: ScheduledEmail[]) => {
    if (statusFilter === 'ALL') return items;
    return items.filter((item) => item.status.toUpperCase() === statusFilter);
  };

  const displayedScheduled = filterList(
    searchResults !== null
      ? searchResults.filter((e) =>
          ['SCHEDULED', 'QUEUED', 'RESCHEDULED', 'SENDING', 'scheduled'].includes(e.status)
        )
      : scheduledList
  );

  const displayedSent = filterList(
    searchResults !== null
      ? searchResults.filter((e) => ['SENT', 'FAILED', 'sent', 'failed'].includes(e.status))
      : sentList
  );

  const scheduledTotalPages = Math.max(1, Math.ceil(scheduledTotal / PAGE_SIZE));
  const sentTotalPages = Math.max(1, Math.ceil(sentTotal / PAGE_SIZE));

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedEmail(null);
        setSearchResults(null);
        setSearchQuery('');
        setStatusFilter('ALL');
      }}
      scheduledCount={scheduledTotal}
      sentCount={sentTotal}
      onComposeClick={() => setIsComposeOpen(true)}
    >
      {activeTab === 'queues' ? (
        <LiveQueueDashboard />
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Metric & Status Bar */}
          <div className="bg-white border-b border-gray-200/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Quick Metrics Chips */}
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60 text-amber-800">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-semibold">{scheduledTotal}</span>
              <span className="text-amber-700/80">Queued</span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00A859]" />
              <span className="font-semibold">{sentTotal}</span>
              <span className="text-emerald-700/80">Delivered</span>
            </div>

            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-100/80 text-gray-700">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-medium">5 Concurrency</span>
            </div>

            <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-100/80 text-gray-700">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-medium">200 / hr Limit</span>
            </div>
          </div>

          {/* Search, Filter & Refresh Controls */}
          <div className="flex items-center space-x-2 flex-1 max-w-md justify-end">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads, subject..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-transparent focus:border-gray-300 focus:bg-white text-xs text-gray-800 placeholder-gray-400 rounded-full pl-8 pr-7 py-1.5 outline-none transition"
              />
              {searchQuery ? (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : isSearching ? (
                <div className="absolute right-2.5 top-2">
                  <Spinner size="sm" />
                </div>
              ) : null}
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                  statusFilter !== 'ALL'
                    ? 'bg-[#E8F8EE] border-[#CEEED8] text-[#00A859]'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title="Filter by status"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {statusFilter === 'ALL' ? 'Filter' : statusFilter}
                </span>
              </button>

              {showFilterMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-xl p-1 z-50 text-xs">
                  {['ALL', 'QUEUED', 'SCHEDULED', 'SENT', 'FAILED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg transition ${
                        statusFilter === st
                          ? 'bg-[#E8F8EE] text-[#00A859] font-bold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button with Tooltip */}
            <button
              onClick={handleRefresh}
              className="p-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-lg transition cursor-pointer"
              title="Refresh table"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main List Table Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* SCHEDULED EMAILS TAB */}
          {activeTab === 'scheduled' && (
            <div className="space-y-4">
              {isScheduledLoading ? (
                <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white rounded-2xl border border-gray-200/60 shadow-xs">
                  <Spinner size="md" />
                  <span className="text-xs text-gray-500 font-medium">Loading queued jobs...</span>
                </div>
              ) : displayedScheduled.length === 0 ? (
                <EmptyState
                  icon={<Clock className="w-6 h-6 text-[#00A859]" />}
                  title="No scheduled emails in queue"
                  description="Compose an email outreach batch to stagger sends with rate limit protection."
                  action={
                    <button
                      onClick={() => setIsComposeOpen(true)}
                      className="bg-[#00A859] hover:bg-[#00924D] text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Compose New Batch</span>
                    </button>
                  }
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-gray-200/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-3.5">Recipient</th>
                        <th className="px-5 py-3.5">Subject & Content</th>
                        <th className="px-5 py-3.5">Scheduled Dispatch</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedScheduled.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                          onClick={() => setSelectedEmail(item)}
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-900">
                            <div>{item.toEmail}</div>
                            {item.sender && (
                              <div className="text-[10px] text-gray-400 font-mono">
                                from: {item.sender.smtpUser}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 max-w-xs">
                            <div className="font-semibold text-gray-900 truncate">{item.subject}</div>
                            <div className="text-gray-400 truncate text-[11px]">
                              {item.body.replace(/\n+/g, ' ')}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{formatDate(item.scheduledFor)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge status={item.status} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(item);
                              }}
                              className="text-gray-400 hover:text-gray-800 p-1 rounded-md hover:bg-gray-100"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SENT EMAILS TAB */}
          {activeTab === 'sent' && (
            <div className="space-y-4">
              {isSentLoading ? (
                <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white rounded-2xl border border-gray-200/60 shadow-xs">
                  <Spinner size="md" />
                  <span className="text-xs text-gray-500 font-medium">Loading sent delivery logs...</span>
                </div>
              ) : displayedSent.length === 0 ? (
                <EmptyState
                  icon={<Send className="w-6 h-6 text-[#00A859]" />}
                  title="No sent emails yet"
                  description="Emails will automatically appear here once dispatched by the BullMQ worker."
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-gray-200/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-3.5">Recipient</th>
                        <th className="px-5 py-3.5">Subject & Content</th>
                        <th className="px-5 py-3.5">Sent Timestamp</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedSent.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                          onClick={() => setSelectedEmail(item)}
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-900">
                            <div>{item.toEmail}</div>
                            {item.sender && (
                              <div className="text-[10px] text-gray-400 font-mono">
                                from: {item.sender.smtpUser}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 max-w-xs">
                            <div className="font-semibold text-gray-900 truncate">{item.subject}</div>
                            <div className="text-gray-400 truncate text-[11px]">
                              {item.body.replace(/\n+/g, ' ')}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#00A859] shrink-0" />
                              <span>{formatDate(item.sentAt || item.updatedAt)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center space-x-1.5">
                              <Badge status={item.status} />
                              {item.status.toUpperCase() === 'FAILED' && item.errorMessage && (
                                <span className="text-rose-500 text-[10px] truncate max-w-[120px]" title={item.errorMessage}>
                                  ({item.errorMessage})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(item);
                              }}
                              className="text-gray-400 hover:text-gray-800 p-1 rounded-md hover:bg-gray-100"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {searchResults === null &&
          ((activeTab === 'scheduled' && scheduledTotal > PAGE_SIZE) ||
            (activeTab === 'sent' && sentTotal > PAGE_SIZE)) && (
            <div className="bg-white px-6 py-3 border-t border-gray-200/80 flex items-center justify-between text-xs text-gray-500 shrink-0">
              <div>
                Showing{' '}
                {activeTab === 'scheduled'
                  ? `${(scheduledPage - 1) * PAGE_SIZE + 1} to ${Math.min(scheduledPage * PAGE_SIZE, scheduledTotal)} of ${scheduledTotal}`
                  : `${(sentPage - 1) * PAGE_SIZE + 1} to ${Math.min(sentPage * PAGE_SIZE, sentTotal)} of ${sentTotal}`}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={activeTab === 'scheduled' ? scheduledPage <= 1 : sentPage <= 1}
                  onClick={() => {
                    if (activeTab === 'scheduled') {
                      const next = scheduledPage - 1;
                      setScheduledPage(next);
                      fetchScheduledEmails(next);
                    } else {
                      const next = sentPage - 1;
                      setSentPage(next);
                      fetchSentEmails(next);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={
                    activeTab === 'scheduled'
                      ? scheduledPage >= scheduledTotalPages
                      : sentPage >= sentTotalPages
                  }
                  onClick={() => {
                    if (activeTab === 'scheduled') {
                      const next = scheduledPage + 1;
                      setScheduledPage(next);
                      fetchScheduledEmails(next);
                    } else {
                      const next = sentPage + 1;
                      setSentPage(next);
                      fetchSentEmails(next);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchScheduledEmails(1);
          setActiveTab('scheduled');
        }}
        senderEmail={user?.email || 'user@reachinbox.ai'}
      />

      {/* Email Details Modal */}
      {selectedEmail && (
        <Modal
          isOpen={!!selectedEmail}
          onClose={() => setSelectedEmail(null)}
          title="Email Dispatch Details"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] border border-gray-200/80 rounded-2xl">
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  Recipient
                </span>
                <span className="text-gray-900 font-mono font-medium">{selectedEmail.toEmail}</span>
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  Status
                </span>
                <Badge status={selectedEmail.status} />
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  Scheduled For
                </span>
                <span className="text-gray-700">{formatDate(selectedEmail.scheduledFor)}</span>
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  {selectedEmail.sentAt ? 'Delivered At' : 'Last Updated'}
                </span>
                <span className="text-gray-700">
                  {formatDate(selectedEmail.sentAt || selectedEmail.updatedAt)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  Delay Interval
                </span>
                <span className="text-gray-700">{(selectedEmail.delayMs || 0) / 1000}s</span>
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px]">
                  BullMQ Job ID
                </span>
                <span className="text-gray-600 font-mono text-[11px] truncate block">
                  {selectedEmail.jobId || selectedEmail.id}
                </span>
              </div>
            </div>

            {/* Error banner if failed */}
            {selectedEmail.errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-rose-800">Dispatch Error</div>
                  <div className="text-[11px] mt-0.5">{selectedEmail.errorMessage}</div>
                </div>
              </div>
            )}

            {/* Subject */}
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px] mb-1">
                Subject
              </span>
              <div className="p-3 bg-white border border-gray-200 rounded-xl text-gray-900 font-medium">
                {selectedEmail.subject}
              </div>
            </div>

            {/* Body Content */}
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold block text-[10px] mb-1">
                Message Content
              </span>
              <div className="p-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto leading-relaxed">
                {selectedEmail.body}
              </div>
            </div>

            {/* Close CTA */}
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};
