import { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Trash2, Download, Globe, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function AdminSubscribers() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.subscribers.list().then(data => {
      setSubs(data);
      setPage(1);
      setSelected(new Set());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = subs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.email?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.source_page?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [subs, search]);

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
    setSelected(new Set(paged.map(s => s.id)));
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subscriber?')) return;
    try {
      await api.subscribers.delete(id);
      setSubs(prev => prev.filter(s => s.id !== id));
      toast.success('Subscriber removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} subscribers?`)) return;
    try {
      await api.subscribers.deleteBulk([...selected]);
      toast.success(`${selected.size} subscribers removed`);
      setSubs(prev => prev.filter(s => !selected.has(s.id)));
      setSelected(new Set());
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const exportCSV = () => {
    const headers = 'Email,Subscribed Date,Source Page,Referrer,Country,City,IP Address,User Agent';
    const rows = subs.map(s =>
      `"${s.email}","${new Date(s.created_date).toLocaleDateString()}","${s.source_page || ''}","${s.referrer || ''}","${s.country || ''}","${s.city || ''}","${s.ip_address || ''}","${s.user_agent || ''}"`
    );
    const csv = headers + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subscribers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const countries = [...new Set(subs.map(s => s.country).filter(Boolean))];

  if (loading) return <div className="text-center py-10 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Subscribers</h1>
          <p className="text-sm text-muted-foreground">{subs.length} total · {countries.length} countries</p>
        </div>
        <div className="flex gap-2">
          {subs.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{subs.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Countries</p>
          <p className="text-2xl font-bold mt-1">{countries.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold mt-1">{subs.filter(s => new Date(s.created_date) > new Date(Date.now() - 30*86400000)).length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">With Location</p>
          <p className="text-2xl font-bold mt-1">{subs.filter(s => s.country).length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by email, country, city..." className="pl-9" />
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{subs.length === 0 ? 'No subscribers yet' : 'No matches'}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Subscribed</th>
                  <th className="text-right p-3 font-medium w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(s => (
                  <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/20 ${selected.has(s.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded" />
                    </td>
                    <td className="p-3 font-medium">{s.email}</td>
                    <td className="p-3">
                      {s.country ? (
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                          {s.country}{s.city ? `, ${s.city}` : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[200px]">
                      {s.source_page ? (
                        <a href={s.source_page} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{(() => { try { return new URL(s.source_page).pathname; } catch { return s.source_page; } })()}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">Direct</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(s.created_date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
