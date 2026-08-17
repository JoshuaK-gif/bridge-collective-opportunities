import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, TrendingUp, Star, Search, ChevronLeft, ChevronRight, Check, X, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 15;

const statusColors = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-gray-100 text-gray-800',
  expired: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export default function AdminOpportunities() {
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const statusFilter = searchParams.get('status');
  const [opportunities, setOpportunities] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [inlineEdit, setInlineEdit] = useState(null);
  const [inlineForm, setInlineForm] = useState({});
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.opportunities.list({ category: categoryFilter || undefined, all: true }).then(data => {
      let filtered = data;
      if (statusFilter) {
        filtered = data.filter(o => o.status === statusFilter);
      }
      setOpportunities(filtered);
      setPage(1);
      setSelected(new Set());
    }).catch(() => {
      toast.error('Failed to load opportunities. Please try again.');
      setOpportunities([]);
      setLoading(false);
    });
    api.categories.list().then(data => setCategories(data)).catch(() => {});
  }, [categoryFilter]);

  const filtered = useMemo(() => {
    if (!search) return opportunities;
    const q = search.toLowerCase();
    return opportunities.filter(o =>
      o.title?.toLowerCase().includes(q) ||
      o.category?.toLowerCase().includes(q) ||
      o.status?.toLowerCase().includes(q)
    );
  }, [opportunities, search]);

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
    setSelected(new Set(paged.map(o => o.id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} opportunities?`)) return;
    try {
      await api.opportunities.deleteBulk([...selected]);
      toast.success(`${selected.size} opportunities deleted`);
      setOpportunities(prev => prev.filter(o => !selected.has(o.id)));
      setSelected(new Set());
    } catch (err) {
      toast.error(err.data?.error || 'Bulk delete failed');
    }
  };

  const handleBulkUpdate = async (data) => {
    if (selected.size === 0) return;
    try {
      const res = await api.opportunities.bulkUpdate([...selected], data);
      toast.success(`${res.updated} opportunities updated`);
      setOpportunities(prev => prev.map(o => selected.has(o.id) ? { ...o, ...data } : o));
      setSelected(new Set());
    } catch (err) {
      toast.error(err.data?.error || 'Bulk update failed');
    }
  };

  const toggleTrending = async (opp) => {
    try {
      await api.opportunities.update(opp.id, { trending: !opp.trending });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, trending: !o.trending } : o));
      toast.success(opp.trending ? 'Removed from trending' : 'Marked as trending');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const toggleFeatured = async (opp) => {
    try {
      const isFeatured = opp.featured_order !== null && opp.featured_order !== undefined;
      const order = isFeatured ? null : (Date.now() % 10000);
      await api.opportunities.update(opp.id, { featured_order: order });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, featured_order: order } : o));
      toast.success(isFeatured ? 'Removed from featured' : 'Added to featured');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await api.opportunities.duplicate(id);
      toast.success('Duplicated as draft');
      const data = await api.opportunities.list({ all: true });
      setOpportunities(data);
    } catch (err) {
      toast.error(err.data?.error || 'Failed to duplicate');
    }
  };

  const handleBulkCategoryChange = async () => {
    if (!bulkCategory || selected.size === 0) return;
    try {
      const res = await api.opportunities.bulkUpdate([...selected], { category: bulkCategory });
      toast.success(`${res.updated} opportunities updated`);
      setOpportunities(prev => prev.map(o => selected.has(o.id) ? { ...o, category: bulkCategory } : o));
      setSelected(new Set());
      setBulkCategory('');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return;
    try {
      const res = await api.opportunities.bulkUpdate([...selected], { status: bulkStatus });
      toast.success(`${res.updated} opportunities updated`);
      setOpportunities(prev => prev.map(o => selected.has(o.id) ? { ...o, status: bulkStatus } : o));
      setSelected(new Set());
      setBulkStatus('');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const handleBulkPublish = async () => {
    const draftIds = [...selected];
    if (draftIds.length === 0) return;
    if (!confirm(`Publish ${draftIds.length} selected drafts?`)) return;
    setBulkPublishing(true);
    try {
      const res = await api.opportunities.bulkPublish(draftIds);
      toast.success(`${res.published} drafts published`);
      const data = await api.opportunities.list({ all: true });
      setOpportunities(data);
      setSelected(new Set());
    } catch (err) {
      toast.error(err.data?.error || 'Bulk publish failed');
    } finally {
      setBulkPublishing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this opportunity?')) return;
    try {
      await api.opportunities.delete(id);
      setOpportunities(prev => prev.filter(o => o.id !== id));
      toast.success('Opportunity deleted');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to delete');
    }
  };

  const startInlineEdit = (opp) => {
    setInlineEdit(opp.id);
    setInlineForm({ title: opp.title, category: opp.category, status: opp.status, deadline: opp.deadline || '' });
  };

  const saveInlineEdit = async (id) => {
    try {
      await api.opportunities.update(id, inlineForm);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, ...inlineForm } : o));
      toast.success('Updated');
      setInlineEdit(null);
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Opportunities</h1>
          {categoryFilter && <Badge variant="secondary">{categoryFilter}</Badge>}
          {statusFilter && <Badge variant="secondary">{statusFilter}</Badge>}
        </div>
        <Link to="/admin-bridgejobs/opportunities/new">
          <Button><Plus className="w-4 h-4 mr-1" /> New Opportunity</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, category, status..." className="pl-9" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => handleBulkUpdate({ trending: true })}>
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Trending
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkUpdate({ trending: false })}>
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Untrend
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkUpdate({ featured_order: Date.now() % 10000 })}>
              <Star className="w-3.5 h-3.5 mr-1" /> Feature
            </Button>
            <Select value={bulkCategory} onValueChange={v => { setBulkCategory(v); setTimeout(() => handleBulkCategoryChange(), 0); }}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Set category..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={bulkStatus} onValueChange={v => { setBulkStatus(v); setTimeout(() => handleBulkStatusChange(), 0); }}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Set status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleBulkPublish} disabled={bulkPublishing}>
              <Send className="w-3.5 h-3.5 mr-1" /> {bulkPublishing ? 'Publishing...' : 'Publish Drafts'}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded" />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14 text-center">Trending</TableHead>
                <TableHead className="w-14 text-center">Featured</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(opp => {
                const isEditing = inlineEdit === opp.id;
                return (
                  <TableRow key={opp.id} className={selected.has(opp.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <input type="checkbox" checked={selected.has(opp.id)} onChange={() => toggleSelect(opp.id)} className="rounded" />
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px]">
                      {isEditing ? (
                        <Input value={inlineForm.title} onChange={e => setInlineForm(f => ({ ...f, title: e.target.value }))} className="text-sm h-8" />
                      ) : (
                        <span className="truncate block cursor-pointer hover:text-primary" onClick={() => startInlineEdit(opp)} title="Click to edit">{opp.title}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input value={inlineForm.category} onChange={e => setInlineForm(f => ({ ...f, category: e.target.value }))} className="text-sm h-8 w-32" />
                      ) : (
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => startInlineEdit(opp)}>{opp.category || '-'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input value={inlineForm.deadline} onChange={e => setInlineForm(f => ({ ...f, deadline: e.target.value }))} className="text-sm h-8 w-28" placeholder="YYYY-MM-DD" />
                      ) : (
                        <span className="cursor-pointer hover:text-primary text-sm" onClick={() => startInlineEdit(opp)}>{opp.deadline || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select value={inlineForm.status} onChange={e => setInlineForm(f => ({ ...f, status: e.target.value }))} className="text-sm border rounded px-1 py-1 bg-background">
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="expired">Expired</option>
                          <option value="pending">Pending</option>
                        </select>
                      ) : (
                        <Badge className={`cursor-pointer capitalize ${statusColors[opp.status] || ''}`} onClick={() => startInlineEdit(opp)}>{opp.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => toggleTrending(opp)}
                        className={`p-1.5 rounded-md transition-colors ${opp.trending ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                        title={opp.trending ? 'Remove from trending' : 'Mark as trending'}>
                        <TrendingUp className="w-4 h-4" />
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => toggleFeatured(opp)}
                        className={`p-1.5 rounded-md transition-colors ${opp.featured_order !== null && opp.featured_order !== undefined ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                        title={opp.featured_order !== null ? 'Remove from featured' : 'Add to featured'}>
                        <Star className="w-4 h-4" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-green-600" onClick={() => saveInlineEdit(opp.id)}><Check className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setInlineEdit(null)}><X className="w-4 h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Link to={`/admin-bridgejobs/opportunities/${opp.id}/edit`}>
                              <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(opp.id)} title="Duplicate">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(opp.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {loading ? 'Loading...' : search || categoryFilter ? 'No matching opportunities' : 'No opportunities yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
