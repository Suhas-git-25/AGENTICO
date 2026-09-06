import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Spinner, useToast } from './ui';

export interface QueueJobItem {
  id: string;
  name: string;
  recipient: string;
  subject: string;
  delayMs?: number;
  attemptsMade: number;
  failedReason?: string;
}

interface QueueMetrics {
  queueName: string;
  isPaused: boolean;
  counts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
    paused?: number;
  };
  workerSettings: {
    concurrency: number;
    minDelayMs: number;
    maxPerHour: number;
  };
  jobs: {
    active: QueueJobItem[];
    delayed: QueueJobItem[];
    failed: QueueJobItem[];
    waiting: QueueJobItem[];
  };
}

export const LiveQueueDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeJobTab, setActiveJobTab] = useState<'active' | 'delayed' | 'waiting' | 'failed'>('delayed');

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await apiGet<{ success: boolean; data: QueueMetrics }>('/api/queues/metrics');
      if (res && res.data) {
        setMetrics(res.data);
      }
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to fetch queue metrics', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => {
      fetchMetrics(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRetryFailed = async () => {
    setIsActionLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>('/api/queues/retry-failed');
      showToast(res.message || 'Retried failed jobs', 'success');
      fetchMetrics();
    } catch (err: any) {
      showToast(err.message || 'Failed to retry jobs', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCleanCompleted = async () => {
    setIsActionLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>('/api/queues/clean');
      showToast(res.message || 'Cleaned completed jobs from queue memory', 'info');
      fetchMetrics();
    } catch (err: any) {
      showToast(err.message || 'Failed to clean queue', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3">
        <Spinner size="lg" />
        <span className="text-xs text-gray-500 font-medium">Connecting to BullMQ Engine...</span>
      </div>
    );
  }

  const counts = metrics?.counts || { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0, paused: 0 };
  const currentJobs = metrics?.jobs[activeJobTab] || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
              LIVE ENGINE ACTIVE
            </span>
            <span className="text-xs text-gray-400 font-mono">Queue: {metrics?.queueName || 'email-sending'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>BullMQ High-Throughput Engine</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h2>
          <p className="text-xs text-gray-400 max-w-xl leading-relaxed">
            Real-time queue state, multi-node worker concurrency, and atomic Redis rate limiter telemetry.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {counts.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={isActionLoading}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed ({counts.failed})</span>
            </button>
          )}

          <button
            onClick={handleCleanCompleted}
            disabled={isActionLoading}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3.5 py-2 rounded-xl flex items-center space-x-1.5 border border-gray-700 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
            <span>Clean History</span>
          </button>

          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/admin/queues?token=admin-reachinbox-secret-token`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#00A859] hover:bg-[#00924D] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
          >
            <span>Raw Bull Board</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Active Jobs */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Active Sending</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{counts.active}</div>
          <div className="text-[11px] text-gray-400">Concurrency slots</div>
        </div>

        {/* Delayed / Scheduled */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Delayed / Timed</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{counts.delayed}</div>
          <div className="text-[11px] text-gray-400">Awaiting schedule window</div>
        </div>

        {/* Waiting */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Waiting in Queue</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{counts.waiting}</div>
          <div className="text-[11px] text-gray-400">Ready for next slot</div>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Delivered (Sent)</span>
            <CheckCircle2 className="w-4 h-4 text-[#00A859]" />
          </div>
          <div className="text-2xl font-bold text-[#00A859]">{counts.completed}</div>
          <div className="text-[11px] text-gray-400">Dispatched via SMTP</div>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Failed Jobs</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{counts.failed}</div>
          <div className="text-[11px] text-gray-400">Auto-retry on backoff</div>
        </div>
      </div>

      {/* Engine Architecture & Rate Limit Specs */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
        <div className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
          Configured Worker & Throttling Architecture
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
            <div className="text-gray-400 font-medium">Worker Concurrency</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">
              {metrics?.workerSettings.concurrency || 5} Parallel Threads
            </div>
          </div>
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
            <div className="text-gray-400 font-medium">Min Delay Between Emails</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">
              {metrics?.workerSettings.minDelayMs || 2000} ms (Distributed Token Bucket)
            </div>
          </div>
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
            <div className="text-gray-400 font-medium">Hourly Rate Limit</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">
              {metrics?.workerSettings.maxPerHour || 200} / hr (Atomic Redis Guard)
            </div>
          </div>
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
            <div className="text-gray-400 font-medium">Persistence Storage</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">
              Upstash Redis + Neon PostgreSQL
            </div>
          </div>
        </div>
      </div>

      {/* Live Job Inspector */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {/* Job Category Tabs */}
        <div className="px-5 py-3 border-b border-gray-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-gray-900 mr-2">Job Inspector:</span>
            {[
              { key: 'delayed', label: 'Delayed / Scheduled', count: counts.delayed },
              { key: 'waiting', label: 'Waiting', count: counts.waiting },
              { key: 'active', label: 'Active', count: counts.active },
              { key: 'failed', label: 'Failed', count: counts.failed },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveJobTab(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  activeJobTab === tab.key
                    ? 'bg-[#E8F8EE] text-[#00A859] font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchMetrics()}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Refresh Metrics"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jobs Table */}
        <div className="overflow-x-auto">
          {currentJobs.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No jobs currently in {activeJobTab} state.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-gray-200/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Job ID</th>
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Delay / Attempts</th>
                  {activeJobTab === 'failed' && <th className="px-5 py-3">Failure Reason</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {currentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3 text-gray-900 font-semibold truncate max-w-[200px]">
                      {job.id}
                    </td>
                    <td className="px-5 py-3 text-gray-700 font-sans">{job.recipient}</td>
                    <td className="px-5 py-3 text-gray-600 font-sans truncate max-w-xs">{job.subject}</td>
                    <td className="px-5 py-3 text-gray-500 font-sans">
                      {job.delayMs ? `${Math.round(job.delayMs / 1000)}s delay` : 'Instant'} (
                      {job.attemptsMade} attempts)
                    </td>
                    {activeJobTab === 'failed' && (
                      <td className="px-5 py-3 text-rose-600 font-sans text-xs">
                        {(job as any).failedReason || 'Unknown error'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
