import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Users, X } from 'lucide-react';
import type { GlobalChatMessage } from '../types/racing';

interface OnlineDriverEntry {
  uid: string;
  displayName: string;
  rating?: number;
}

interface GlobalChatSidebarProps {
  messages: GlobalChatMessage[];
  onlineDriversCount: number;
  onlineDriversList: OnlineDriverEntry[];
  wsConnected: boolean;
  currentUid: string | null;
  onSendMessage: (text: string) => void;
  onSignIn: () => void;
  onClose?: () => void;
  className?: string;
}

function formatChatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function GlobalChatSidebar({
  messages,
  onlineDriversCount,
  onlineDriversList,
  wsConnected,
  currentUid,
  onSendMessage,
  onSignIn,
  onClose,
  className = '',
}: GlobalChatSidebarProps) {
  const [draft, setDraft] = useState('');
  const [showDrivers, setShowDrivers] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || !currentUid) return;
    onSendMessage(cleaned);
    setDraft('');
  };

  return (
    <aside
      aria-label="Global lobby chat"
      className={`flex flex-col bg-[#111722] border border-white/10 rounded-2xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="font-display text-sm font-bold text-white truncate">Global Driver Chat</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
            {wsConnected ? `${onlineDriversCount} Online` : 'Reconnecting...'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowDrivers((v) => !v)}
            title="Toggle online drivers list"
            aria-label="Toggle online drivers list"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showDrivers ? 'bg-white/14 text-white' : 'bg-white/6 hover:bg-white/12 text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">{onlineDriversList.length}</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide chat sidebar"
              className="p-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Online Drivers Directory */}
      {showDrivers && (
        <div className="px-4 py-3 border-b border-white/10 bg-[#0B0F14]/70 space-y-1.5 max-h-36 overflow-y-auto shrink-0">
          <p className="text-[11px] text-slate-400 font-medium">Drivers in Lobby</p>
          {onlineDriversList.length === 0 ? (
            <p className="text-xs text-slate-500">No signed-in drivers connected yet.</p>
          ) : (
            <div className="space-y-1">
              {onlineDriversList.map((d) => (
                <div key={d.uid} className="flex items-center justify-between text-xs">
                  <span className={d.uid === currentUid ? 'text-amber-300 font-medium truncate' : 'text-slate-200 truncate'}>
                    {d.displayName}
                    {d.uid === currentUid ? ' (You)' : ''}
                  </span>
                  {typeof d.rating === 'number' && (
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0 ml-2">
                      {d.rating} ELO
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">
            No messages yet. Say hello to drivers waiting for a race.
          </p>
        ) : (
          messages.map((msg) => {
            if (msg.system) {
              return (
                <div key={msg.id} className="py-2 border-y border-white/6 text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">{msg.displayName}: </span>
                  {msg.text}
                </div>
              );
            }

            const isMine = currentUid !== null && msg.uid === currentUid;
            return (
              <div key={msg.id} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className={`font-semibold truncate ${isMine ? 'text-amber-300' : 'text-slate-200'}`}>
                    {msg.displayName}
                    {typeof msg.rating === 'number' && (
                      <span className="font-mono font-normal text-slate-500 ml-1.5 tabular-nums">{msg.rating}</span>
                    )}
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums shrink-0">
                    {formatChatTime(msg.createdAtMs)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed break-words">{msg.text}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-white/10 bg-[#0B0F14]/80 shrink-0">
        {currentUid ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={240}
              disabled={!wsConnected}
              placeholder={wsConnected ? 'Chat with online drivers...' : 'Connecting...'}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#111722] border border-white/12 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!wsConnected || !draft.trim()}
              aria-label="Send message"
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-semibold inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-2 px-3 rounded-lg bg-white/8 hover:bg-white/14 text-slate-200 text-xs font-semibold transition-colors"
          >
            Sign In with Google to Chat
          </button>
        )}
      </div>
    </aside>
  );
}
