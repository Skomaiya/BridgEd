import { useState, useEffect, useRef, useCallback } from 'react';
import { messagesAPI, reportsAPI } from '../api/api';
import ConfirmationModal from './ConfirmationModal';
import { useAlert } from '../context/GlobalAlertContext';

const POLL_INTERVAL = 10_000;

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesPage({ user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const prevSelectedIdRef = useRef(null);
  const menuRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDesc, setReportDesc] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [reporting, setReporting] = useState(false);
  const dropdownRef = useRef(null);
  const { showAlert } = useAlert();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`bridged_hidden_convs_${user?.user_id}`) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (user?.user_id) {
      localStorage.setItem(`bridged_hidden_convs_${user.user_id}`, JSON.stringify(hiddenIds));
    }
  }, [hiddenIds, user?.user_id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = useCallback(async () => {
    try {
      const data = await messagesAPI.listConversations();
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      setConversations(list);
    } catch {
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId, silent = false) => {
    if (!convId) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const data = await messagesAPI.getMessages(convId);
      const newMessages = Array.isArray(data) ? data : (data?.results ?? []);
      
      setMessages(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newMessages)) return prev;
        return newMessages;
      });
      
      loadConversations();
    } catch {
      setError('Failed to load messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId !== prevSelectedIdRef.current) {
      setMessages([]);
      setError('');
      loadMessages(selectedId);
      inputRef.current?.focus();
    }
    prevSelectedIdRef.current = selectedId;

    const id = setInterval(() => loadMessages(selectedId, true), POLL_INTERVAL);
    
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowReasonDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearInterval(id);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConversation = (convId) => {
    setSelectedId(convId);
    setConversations(prev =>
      prev.map(c => c.conversation_id === convId ? { ...c, unread_count: 0 } : c)
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      const newMsg = await messagesAPI.sendMessage(selectedId, body);
      setMessages(prev => [...prev, newMsg]);
      setDraft('');
      loadConversations();
    } catch {
      showAlert('Failed to send message. Please try again.', 'Error', 'error');
    } finally {
      setSending(false);
    }
  };

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const canEdit = (msg) => {
    if (!msg || !user) return false;
    const isMine = msg.sender === user.user_id || msg.sender_role === user.role;
    if (!isMine) return false;
    const sentAt = new Date(msg.sent_at);
    const now = new Date();
    return (now - sentAt) < 300_000;
  };

  const startEdit = (msg) => {
    setEditingId(msg.message_id);
    setEditDraft(msg.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const body = editDraft.trim();
    if (!body || !selectedId || !editingId || sending) return;
    setSending(true);
    try {
      const updatedMsg = await messagesAPI.editMessage(selectedId, editingId, body);
      setMessages(prev => prev.map(m => m.message_id === editingId ? updatedMsg : m));
      setEditingId(null);
      setEditDraft('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update message.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteChat = () => {
    if (!selectedId) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteChat = async () => {
    if (!selectedId) return;
    setHiddenIds(prev => [...new Set([...prev, selectedId])]);
    setSelectedId(null);
    setShowDeleteModal(false);
    setShowMenu(false);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConv || !reportDesc.trim()) return;
    
    setReporting(true);
    setReportError('');
    try {
      const payload = {
        reported_user: selectedConv.other_party_user_id,
        reason: reportReason,
        description: reportDesc
      };
      await reportsAPI.reportUser(payload);
      setReportSuccess(true);
      setReportDesc('');
    } catch (err) {
      setReportError('Failed to submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const selectedConv = conversations.find(c => c.conversation_id === selectedId);
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  const visibleConversations = conversations.filter(conv => {
    const isHidden = hiddenIds.includes(conv.conversation_id);
    const hasNew = conv.unread_count > 0;
    
    if (isHidden && hasNew) {
      setTimeout(() => {
        setHiddenIds(prev => prev.filter(id => id !== conv.conversation_id));
      }, 0);
      return true;
    }
    return !isHidden;
  });

  return (
    <div className="mx-auto flex h-[min(100dvh,56rem)] w-full min-w-0 max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-bridged-primary/10 bg-white/80 shadow-xl backdrop-blur-sm transition-colors dark:border-white/10 dark:bg-bridged-primary/60 lg:h-[calc(100dvh-5.5rem)] lg:flex-row">

      <div
        className={`flex min-h-0 shrink-0 flex-col border-bridged-primary/10 bg-bridged-primary/5 dark:border-white/10 dark:bg-transparent lg:border-r ${
          selectedId ? 'hidden h-full w-full lg:flex lg:w-80' : 'flex h-full min-h-0 w-full flex-1'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-bridged-primary/10 px-4 py-3 dark:border-white/10">
          <h2 className="text-base font-bold text-bridged-primary dark:text-white">
            Messages
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-bridged-teal px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                {totalUnread}
              </span>
            )}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-bridged-teal/30 border-t-bridged-teal" />
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <i className="fa-regular fa-comment-dots mb-3 text-4xl text-white/20" aria-hidden />
              <p className="text-sm text-white/40">
                {user?.role === 'employer'
                  ? 'Start a conversation by messaging an accepted match from the Matches page.'
                  : 'No messages yet. Employers will message you once you accept a match.'}
              </p>
            </div>
          ) : (
            visibleConversations.map(conv => (
              <button
                key={conv.conversation_id}
                type="button"
                onClick={() => handleSelectConversation(conv.conversation_id)}
                className={`flex w-full min-w-0 items-start gap-3 border-b border-bridged-primary/5 px-4 py-3 text-left transition-colors dark:border-white/5 ${
                  selectedId === conv.conversation_id
                    ? 'border-l-2 border-l-bridged-teal bg-bridged-teal/10 dark:bg-bridged-teal/20'
                    : 'hover:bg-bridged-primary/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bridged-teal/30 text-sm font-bold text-bridged-teal">
                  {(conv.other_party_name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`min-w-0 flex-1 break-words text-sm font-semibold leading-snug ${
                        selectedId === conv.conversation_id
                          ? 'text-bridged-teal'
                          : 'text-bridged-primary dark:text-white'
                      }`}
                    >
                      {conv.other_party_name}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-bridged-primary/40 dark:text-white/30">
                      {conv.last_message?.sent_at ? formatTime(conv.last_message.sent_at) : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-start justify-between gap-2">
                    <p
                      className={`min-w-0 flex-1 break-words text-xs leading-snug line-clamp-2 ${
                        conv.unread_count > 0
                          ? 'font-bold text-bridged-primary dark:text-white'
                          : 'text-bridged-primary/50 dark:text-white/40'
                      }`}
                    >
                      {conv.last_message?.body ?? 'No messages yet'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-bridged-teal px-1 text-[10px] font-bold text-white shadow-sm">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${
          selectedId ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <i className="fa-regular fa-comment-dots mb-4 text-5xl text-bridged-primary/10 dark:text-white/10" aria-hidden />
            <p className="text-sm font-medium text-bridged-primary/30 dark:text-white/30">
              Select a conversation to start chatting
            </p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-3 sm:gap-3 sm:px-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="shrink-0 rounded-lg p-2 text-bridged-primary/60 hover:bg-bridged-primary/10 hover:text-bridged-primary lg:hidden dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Back to conversations"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <div className="h-9 w-9 rounded-full bg-bridged-teal/30 flex items-center justify-center text-bridged-teal font-bold text-sm">
                {(selectedConv?.other_party_name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold leading-snug text-bridged-primary dark:text-white">
                  {selectedConv?.other_party_name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bridged-teal" />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-bridged-primary/40 dark:text-white/40">
                    {user?.role === 'employer' ? 'Student' : 'Employer'}
                  </p>
                </div>
              </div>

              <div className="ml-auto relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-white/50 hover:text-white transition-colors"
                  aria-label="Chat menu"
                >
                  <i className="fa-solid fa-ellipsis-vertical" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-bridged-primary border border-bridged-primary/10 dark:border-white/10 shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="w-full text-left px-4 py-2.5 text-sm text-bridged-primary/70 dark:text-white/70 hover:text-bridged-primary dark:hover:text-white hover:bg-bridged-primary/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-flag text-red-500/70" /> Report User
                    </button>
                    <button
                      onClick={handleDeleteChat}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500/80 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-trash-can" /> Delete Chat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showReportModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-bridged-primary border border-bridged-primary/10 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl transition-colors">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-bridged-primary dark:text-white">Report User</h3>
                    <button 
                      onClick={() => {
                        setShowReportModal(false);
                        setReportSuccess(false);
                        setReportError('');
                      }} 
                      className="text-bridged-primary/30 dark:text-white/30 hover:text-red-500 transition-colors"
                    >
                      <i className="fa-solid fa-xmark text-lg" />
                    </button>
                  </div>
                  
                  {reportSuccess ? (
                    <div className="py-8 text-center">
                      <i className="fa-solid fa-circle-check text-4xl text-bridged-teal mb-3" />
                      <p className="text-bridged-primary dark:text-white font-bold">Report submitted successfully.</p>
                      <p className="text-bridged-primary/50 dark:text-white/50 text-sm mt-1">Our safety team will review this shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleReportSubmit} className="space-y-4">
                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-bold text-bridged-primary/70 dark:text-white/70 mb-2 uppercase tracking-wider text-[10px]">Reason for reporting</label>
                        <button
                          type="button"
                          onClick={() => setShowReasonDropdown(!showReasonDropdown)}
                          className="w-full flex items-center justify-between bg-bridged-primary/5 dark:bg-white/5 border border-bridged-primary/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-bridged-primary dark:text-white outline-none focus:ring-1 focus:ring-bridged-teal transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const reason = [
                                { value: 'harassment', label: 'Harassment', icon: 'fa-user-shield' },
                                { value: 'spam', label: 'Spam', icon: 'fa-envelopes-bulk' },
                                { value: 'inappropriate_content', label: 'Inappropriate Content', icon: 'fa-triangle-exclamation' },
                                { value: 'scam', label: 'Scam/Fraud', icon: 'fa-hand-holding-dollar' },
                                { value: 'other', label: 'Other', icon: 'fa-circle-info' },
                              ].find(r => r.value === reportReason);
                              return (
                                <>
                                  <i className={`fa-solid ${reason?.icon} text-red-500/70`} />
                                  <span>{reason?.label}</span>
                                </>
                              );
                            })()}
                          </div>
                          <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${showReasonDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showReasonDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-bridged-primary border border-bridged-primary/10 dark:border-white/10 rounded-xl shadow-2xl z-[110] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {[
                              { value: 'harassment', label: 'Harassment', icon: 'fa-user-shield' },
                              { value: 'spam', label: 'Spam', icon: 'fa-envelopes-bulk' },
                              { value: 'inappropriate_content', label: 'Inappropriate Content', icon: 'fa-triangle-exclamation' },
                              { value: 'scam', label: 'Scam/Fraud', icon: 'fa-hand-holding-dollar' },
                              { value: 'other', label: 'Other', icon: 'fa-circle-info' },
                            ].map((reason) => (
                              <button
                                key={reason.value}
                                type="button"
                                onClick={() => {
                                  setReportReason(reason.value);
                                  setShowReasonDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                                  ${reportReason === reason.value 
                                    ? 'bg-bridged-primary/10 dark:bg-white/10 text-bridged-primary dark:text-white font-bold' 
                                    : 'text-bridged-primary/60 dark:text-white/60 hover:bg-bridged-primary/5 dark:hover:bg-white/5 hover:text-bridged-primary dark:hover:text-white'}`}
                              >
                                <i className={`fa-solid ${reason.icon} w-5 text-center ${reportReason === reason.value ? 'text-red-500' : 'text-red-500/50'}`} />
                                {reason.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-bridged-primary/70 dark:text-white/70 mb-1.5 uppercase tracking-wider text-[10px]">Description</label>
                        <textarea
                          value={reportDesc}
                          onChange={e => setReportDesc(e.target.value)}
                          required
                          placeholder="Please provide details about the misconduct..."
                          className="w-full bg-bridged-primary/5 dark:bg-white/5 border border-bridged-primary/10 dark:border-white/10 rounded-xl px-3 py-2 text-bridged-primary dark:text-white h-32 outline-none focus:ring-1 focus:ring-bridged-teal transition-all"
                        />
                      </div>
                      {reportError && <p className="text-xs text-red-400">{reportError}</p>}
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReportModal(false)}
                          className="px-4 py-2 text-sm text-bridged-primary/50 dark:text-white/50 hover:text-bridged-primary dark:hover:text-white font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={reporting || !reportDesc.trim()}
                          className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50"
                        >
                          {reporting ? <i className="fa-solid fa-spinner animate-spin" /> : 'Submit Report'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-bridged-teal/30 border-t-bridged-teal" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                   <div className="h-16 w-16 rounded-full bg-bridged-primary/5 dark:bg-white/5 flex items-center justify-center mb-4">
                      <i className="fa-regular fa-comment-dots text-2xl text-bridged-primary/20 dark:text-white/20" />
                   </div>
                   <p className="text-sm font-medium text-bridged-primary/30 dark:text-white/30">
                     No messages yet. Say hello!
                   </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender === user?.user_id || msg.sender_role === user?.role;
                  const isEditing = editingId === msg.message_id;
                  
                  return (
                    <div key={msg.message_id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`group relative max-w-[min(92%,36rem)] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm transition-all
                        ${isMine
                          ? 'bg-bridged-teal text-white rounded-br-sm shadow-bridged-teal/10'
                          : 'bg-bridged-primary/5 dark:bg-white/10 text-bridged-primary dark:text-white/90 rounded-bl-sm border border-bridged-primary/5 dark:border-transparent'}`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              autoFocus
                              className="w-full bg-white/10 text-white rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-white/30 resize-none min-h-[60px]"
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={cancelEdit}
                                className="text-[10px] font-bold uppercase opacity-60 hover:opacity-100"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleUpdate}
                                disabled={sending || !editDraft.trim()}
                                className="text-[10px] font-bold uppercase opacity-60 hover:opacity-100 flex items-center gap-1"
                              >
                                {sending ? <i className="fa-solid fa-spinner animate-spin" /> : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                            
                            {isMine && canEdit(msg) && (
                              <button
                                onClick={() => startEdit(msg)}
                                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-white/40 hover:text-white"
                                title="Edit message"
                              >
                                <i className="fa-solid fa-pen text-xs" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <p className="text-[10px] font-medium text-bridged-primary/40 dark:text-white/40">
                          {formatTime(msg.sent_at)}
                          {msg.is_edited && <span className="ml-1 italic opacity-60">(Edited)</span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {error && (
                <p className="text-center text-xs text-red-400 py-2">{error}</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className="flex items-end gap-2 px-4 py-3 border-t border-white/10 bg-white/5"
            >
              <textarea
                ref={inputRef}
                id="message-input"
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  setError('');
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Type a message…"
                rows={1}
                maxLength={4000}
                className="flex-1 resize-none rounded-2xl bg-bridged-primary/5 dark:bg-white/10 px-4 py-2.5 text-sm text-bridged-primary dark:text-white
                  placeholder-bridged-primary/30 dark:placeholder-white/30 border border-transparent focus:border-bridged-teal/30 focus:bg-white dark:focus:bg-white/15
                  outline-none transition-all min-h-[42px] max-h-[120px] shadow-inner"
                aria-label="Message input"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="h-10 w-10 shrink-0 rounded-full bg-bridged-teal flex items-center justify-center
                  text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bridged-teal/80
                  transition-colors shadow"
                aria-label="Send message"
              >
                {sending
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <i className="fa-solid fa-paper-plane text-sm" aria-hidden />
                }
              </button>
            </form>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Conversation"
        message="Are you sure you want to delete this chat? It will be hidden from your view, but can be restarted if you or the other party sends a new message."
        confirmText="Delete Chat"
        onConfirm={confirmDeleteChat}
        onCancel={() => setShowDeleteModal(false)}
        loading={loadingMsgs}
        type="danger"
      />
    </div>
  );
}
