import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, X, ExternalLink } from 'lucide-react';

export default function AdminNews() {
  const [news, setNews] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.news.list().then(setNews).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!editing.title?.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await api.news.update(editing.id, editing);
      } else {
        await api.news.create(editing);
      }
      toast.success(editing.id ? 'News updated' : 'News created');
      setEditing(null);
      load();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this news item?')) return;
    try {
      await api.news.delete(id);
      toast.success('News deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">News Manager</h1>
        <Button size="sm" onClick={() => setEditing({ title: '', content: '', image_url: '', link: '' })}>
          <Plus className="w-4 h-4 mr-1" /> Add News
        </Button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">{editing.id ? 'Edit News' : 'New News'}</h2>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input value={editing.title} onChange={e => setEditing(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL</label>
              <Input value={editing.image_url || ''} onChange={e => setEditing(prev => ({ ...prev, image_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Content</label>
            <Textarea value={editing.content || ''} onChange={e => setEditing(prev => ({ ...prev, content: e.target.value }))} rows={4} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Link (optional)</label>
              <Input value={editing.link || ''} onChange={e => setEditing(prev => ({ ...prev, link: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Published Date</label>
              <Input type="date" value={editing.published_date ? editing.published_date.slice(0, 10) : ''} onChange={e => setEditing(prev => ({ ...prev, published_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {news.length === 0 && (
          <p className="text-center py-10 text-muted-foreground">No news items yet.</p>
        )}
        {news.map(item => (
          <div key={item.id} className="flex items-start gap-4 rounded-xl border bg-card p-4">
            {item.image_url && (
              <img src={item.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm mb-0.5 truncate">{item.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {new Date(item.published_date || item.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditing(item)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
