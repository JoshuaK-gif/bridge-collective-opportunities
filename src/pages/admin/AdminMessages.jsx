import { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Trash2, CheckCheck, ChevronDown, ChevronUp, Search, Reply, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [replyText, setReplyText] = useState({});

  useEffect(() => {
    api.messages.list().then(data => {
      setMessages(data);
      setPage(1);
      setSelected(new Set());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = messages;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.subject?.toLowerCase().includes(q) ||
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.message?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectAll = selected.size === paged.length && paged.length > 0;
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectAll) { setSelected(new Set()); return; }
    setSelected(new Set(paged.map(m => m.id)));
  };

  const handleMarkRead = async (id) => {
    try {
      await api.messages.markRead(id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.messages.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} messages?`)) return;
    try {
      await api.messages.deleteBulk([...selected]);
      toast.success(`${selected.size} messages deleted`);
      setMessages(prev => prev.filter(m => !selected.has(m.id)));
      setSelected(new Set());
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const unread = messages.filter(m => !m.is_read).length;

  if (loading) return <div className="text-center py-10 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Messages</h1>
          <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} unread · ${messages.length} total` : `${messages.length} total`}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search subject, name, email..." className="pl-9" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{selected.size} selected</span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>

      {paged.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{messages.length === 0 ? 'No messages yet' : 'No matches'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map(msg => {
            const isExpanded = expanded === msg.id;
            const reply = replyText[msg.id] || '';
            return (
              <div key={msg.id} className={`rounded-xl border bg-card ${msg.is_read ? '' : 'ring-1 ring-primary/20'}`}>
                <div className="flex items-center gap-2 px-2 pt-2">
                  <input type="checkbox" checked={selected.has(msg.id)} onChange={() => toggleSelect(msg.id)} className="rounded ml-1" />
                </div>
                <button
                  onClick={() => setExpanded(isExpanded ? null : msg.id)}
                  className="w-full flex items-center justify-between p-4 pt-1 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${msg.is_read ? 'bg-transparent' : 'bg-primary'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${msg.is_read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                        {msg.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {msg.name} &lt;{msg.email}&gt; &middot; {new Date(msg.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!msg.is_read && (
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={e => { e.stopPropagation(); handleMarkRead(msg.id); }} title="Mark read">
                        <CheckCheck className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <a href={`mailto:${msg.email}?subject=Re: ${msg.subject}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="w-7 h-7" title="Reply via email">
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(msg.id); }} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t">
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">{msg.message}</div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={reply}
                        onChange={e => setReplyText(r => ({ ...r, [msg.id]: e.target.value }))}
                        placeholder="Quick reply (opens email client)..."
                        className="text-sm"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && reply.trim()) {
                            window.open(`mailto:${msg.email}?subject=Re: ${msg.subject}&body=${encodeURIComponent(reply)}`, '_blank');
                            setReplyText(r => ({ ...r, [msg.id]: '' }));
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={!reply.trim()}
                        onClick={() => {
                          window.open(`mailto:${msg.email}?subject=Re: ${msg.subject}&body=${encodeURIComponent(reply)}`, '_blank');
                          setReplyText(r => ({ ...r, [msg.id]: '' }));
                        }}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" /> Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="w-8" onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
