import React, { useState, useRef } from 'react';
import {
  Upload,
  Paperclip,
  Clock,
  ArrowLeft,
  X,
  RotateCcw,
  RotateCw,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  ChevronDown,
} from 'lucide-react';
import { useToast } from './ui';
import { apiPost } from '../lib/api';

export interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  senderEmail?: string;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  senderEmail = 'oliver.brown@domain.io',
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Scheduling configuration
  const defaultStartTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSendLaterPopover, setShowSendLaterPopover] = useState(false);

  // Email regex validator
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const extractEmails = (text: string): string[] => {
    const tokens = text.split(/[\r\n,;\t\s]+/);
    const validEmails = new Set<string>();

    for (const token of tokens) {
      const cleaned = token.trim().replace(/^['"<]+|['">]+$/g, '');
      if (cleaned && emailRegex.test(cleaned)) {
        validEmails.add(cleaned.toLowerCase());
      }
    }
    return Array.from(validEmails);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const detected = extractEmails(content);
      setParsedRecipients((prev) => Array.from(new Set([...prev, ...detected])));

      if (detected.length === 0) {
        showToast('No valid email addresses found in the file.', 'error');
      } else {
        showToast(`Parsed ${detected.length} recipients from ${file.name}`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleKeyDownManualInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (manualInput.trim()) {
        const detected = extractEmails(manualInput);
        if (detected.length > 0) {
          setParsedRecipients((prev) => Array.from(new Set([...prev, ...detected])));
          setManualInput('');
        }
      }
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setParsedRecipients((prev) => prev.filter((e) => e !== email));
  };

  // Quick preset helper for Send Later
  const setPresetTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 3600000);
    setStartTime(d.toISOString().slice(0, 16));
    setShowSendLaterPopover(false);
    showToast(`Scheduled for ${d.toLocaleString()}`, 'info');
  };

  const handleSubmit = async (isSendLater = false) => {
    let finalRecipients = [...parsedRecipients];
    if (manualInput.trim()) {
      const detected = extractEmails(manualInput);
      finalRecipients = Array.from(new Set([...finalRecipients, ...detected]));
    }

    if (finalRecipients.length === 0) {
      showToast('Please specify at least one recipient email.', 'error');
      return;
    }

    if (!subject.trim()) {
      showToast('Subject line is required.', 'error');
      return;
    }

    if (!body.trim()) {
      showToast('Email body is required.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim(),
        startTime: isSendLater
          ? new Date(startTime).toISOString()
          : new Date().toISOString(),
        delayBetweenEmailsMs: Math.max(0, Number(delaySeconds) * 1000),
        hourlyLimit: Math.max(1, Number(hourlyLimit)),
      };

      await apiPost('/api/emails/schedule', payload);

      showToast(`Successfully queued ${finalRecipients.length} emails!`, 'success');
      onSuccess();
      onClose();

      // Reset form
      setSubject('');
      setBody('');
      setParsedRecipients([]);
      setManualInput('');
      setFileName(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule emails.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto selection:bg-[#00A859] selection:text-white">
      {/* Top Navigation Bar matching Figma */}
      <div className="h-16 border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 bg-white z-20">
        {/* Left: Back Arrow + Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-gray-900">Compose New Email</h2>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3 relative">
          {/* File Attachment Icon */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-[#00A859] hover:bg-gray-100 rounded-full transition relative cursor-pointer"
            title="Upload CSV / List"
          >
            <Paperclip className="w-4 h-4" />
            {fileName && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#00A859] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                1
              </span>
            )}
          </button>

          {/* Clock Icon (Toggle Send Later Popover) */}
          <button
            type="button"
            onClick={() => setShowSendLaterPopover(!showSendLaterPopover)}
            className="p-2 text-gray-500 hover:text-[#00A859] hover:bg-gray-100 rounded-full transition cursor-pointer"
            title="Schedule Dispatch"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Send Later Button (Figma Green Pill) */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="border-2 border-[#00A859] text-[#00A859] hover:bg-[#E8F8EE] font-semibold px-4 py-1.5 rounded-full text-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Scheduling...' : 'Send Later'}
          </button>

          {/* Send Now Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="bg-[#00A859] hover:bg-[#00924D] text-white font-semibold px-4 py-1.5 rounded-full text-xs transition shadow-none cursor-pointer disabled:opacity-50"
          >
            Send
          </button>

          {/* Send Later Popover Card matching Figma */}
          {showSendLaterPopover && (
            <div className="absolute right-0 top-12 w-72 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 z-50 text-xs">
              <div className="font-bold text-gray-900 mb-2">Send Later</div>
              <div className="relative mb-3">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-transparent rounded-lg px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#00A859] focus:bg-white"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1 mb-4 border-t border-gray-100 pt-2 text-gray-600">
                <div
                  onClick={() => setPresetTime(24)}
                  className="px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <span>Tomorrow</span>
                </div>
                <div
                  onClick={() => setPresetTime(14)}
                  className="px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <span>Tomorrow, 10:00 AM</span>
                </div>
                <div
                  onClick={() => setPresetTime(15.5)}
                  className="px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <span>Tomorrow, 11:30 AM</span>
                </div>
                <div
                  onClick={() => setPresetTime(19)}
                  className="px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <span>Tomorrow, 3:00 PM</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSendLaterPopover(false)}
                  className="text-gray-400 hover:text-gray-600 font-medium px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendLaterPopover(false)}
                  className="border border-[#00A859] text-[#00A859] hover:bg-[#E8F8EE] font-semibold px-3 py-1 rounded-full text-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.txt"
        className="hidden"
      />

      {/* Main Compose Form Fields */}
      <div className="max-w-4xl w-full mx-auto p-6 space-y-4">
        {/* From Field */}
        <div className="flex items-center space-x-4">
          <span className="text-xs font-semibold text-gray-500 w-16">From</span>
          <div className="inline-flex items-center space-x-1.5 bg-[#F3F4F6] px-3 py-1.5 rounded-lg text-xs font-medium text-gray-800">
            <span>{senderEmail}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </div>
        </div>

        {/* To / Recipients Field with Chips */}
        <div className="flex items-start space-x-4 border-b border-gray-100 pb-3">
          <span className="text-xs font-semibold text-gray-500 w-16 pt-1.5">To</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5">
            {parsedRecipients.map((rec) => (
              <span
                key={rec}
                className="inline-flex items-center space-x-1 bg-[#E8F8EE] border border-[#00A859] text-[#00A859] px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                <span>{rec}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec)}
                  className="hover:text-rose-600 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder={parsedRecipients.length === 0 ? "recipient@example.com (press Enter or comma)" : "Add more..."}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleKeyDownManualInput}
              className="flex-1 min-w-[200px] border-none outline-none text-xs text-gray-900 placeholder-gray-400 py-1"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[#00A859] hover:underline text-xs font-semibold flex items-center space-x-1 cursor-pointer shrink-0 pt-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload List</span>
          </button>
        </div>

        {/* Subject Field */}
        <div className="flex items-center space-x-4 border-b border-gray-100 pb-3">
          <span className="text-xs font-semibold text-gray-500 w-16">Subject</span>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 border-none outline-none text-xs text-gray-900 placeholder-gray-400 py-1"
          />
        </div>

        {/* Throttle Controls matching Figma */}
        <div className="flex items-center space-x-6 pt-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-14 text-center bg-[#F3F4F6] border border-transparent focus:border-[#00A859] focus:bg-white rounded-lg py-1 text-xs text-gray-800 outline-none font-mono"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Hourly Limit</span>
            <input
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-14 text-center bg-[#F3F4F6] border border-transparent focus:border-[#00A859] focus:bg-white rounded-lg py-1 text-xs text-gray-800 outline-none font-mono"
            />
          </div>
        </div>

        {/* Rich Body Editor Area matching Figma */}
        <div className="bg-[#F9FAFB] rounded-2xl p-4 border border-gray-100 min-h-[360px] flex flex-col">
          {/* Floating Pill Toolbar */}
          <div className="bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-xs inline-flex items-center space-x-3 text-gray-500 text-xs mb-3 self-start">
            <button type="button" className="hover:text-gray-900"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><RotateCw className="w-3.5 h-3.5" /></button>
            <div className="h-3 w-px bg-gray-200" />
            <button type="button" className="font-bold hover:text-gray-900">Tᴛ</button>
            <button type="button" className="hover:text-gray-900"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><UnderlineIcon className="w-3.5 h-3.5" /></button>
            <div className="h-3 w-px bg-gray-200" />
            <button type="button" className="hover:text-gray-900"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><ListOrdered className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><List className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><Quote className="w-3.5 h-3.5" /></button>
            <button type="button" className="hover:text-gray-900"><LinkIcon className="w-3.5 h-3.5" /></button>
          </div>

          {/* Textarea */}
          <textarea
            rows={12}
            placeholder="Type Your Reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400 resize-none font-sans leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
