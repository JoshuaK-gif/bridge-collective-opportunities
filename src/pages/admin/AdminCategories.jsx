import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Check, X, Briefcase, GraduationCap, BookOpen, Users, Handshake, Award, DollarSign, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const iconMap = {
  Briefcase: Briefcase, GraduationCap, BookOpen, Users, Handshake, Award, DollarSign,
};

const iconOptions = ['Briefcase', 'GraduationCap', 'BookOpen', 'Users', 'Handshake', 'Award', 'DollarSign'];
const colorOptions = [
  { value: 'text-blue-600 bg-blue-100', label: 'Blue' },
  { value: 'text-green-600 bg-green-100', label: 'Green' },
  { value: 'text-purple-600 bg-purple-100', label: 'Purple' },
  { value: 'text-orange-600 bg-orange-100', label: 'Orange' },
  { value: 'text-pink-600 bg-pink-100', label: 'Pink' },
  { value: 'text-teal-600 bg-teal-100', label: 'Teal' },
  { value: 'text-amber-600 bg-amber-100', label: 'Amber' },
  { value: 'text-red-600 bg-red-100', label: 'Red' },
  { value: 'text-indigo-600 bg-indigo-100', label: 'Indigo' },
];

const accentOptions = [
  { accent: 'bg-blue-500', accent_bg: 'bg-blue-50', label: 'Blue' },
  { accent: 'bg-green-500', accent_bg: 'bg-green-50', label: 'Green' },
  { accent: 'bg-purple-500', accent_bg: 'bg-purple-50', label: 'Purple' },
  { accent: 'bg-orange-500', accent_bg: 'bg-orange-50', label: 'Orange' },
  { accent: 'bg-pink-500', accent_bg: 'bg-pink-50', label: 'Pink' },
  { accent: 'bg-teal-500', accent_bg: 'bg-teal-50', label: 'Teal' },
  { accent: 'bg-amber-500', accent_bg: 'bg-amber-50', label: 'Amber' },
  { accent: 'bg-red-500', accent_bg: 'bg-red-50', label: 'Red' },
  { accent: 'bg-indigo-500', accent_bg: 'bg-indigo-50', label: 'Indigo' },
];

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: 'Briefcase', color: 'text-blue-600 bg-blue-100', accent: 'bg-blue-500', accent_bg: 'bg-blue-50' });

  const load = async () => {
    try {
      const [cats, opps] = await Promise.all([api.categories.list(), api.opportunities.list({ all: true })]);
      setCategories(cats);
      setOpportunities(opps);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = {};
  for (const opp of opportunities) {
    counts[opp.category] = (counts[opp.category] || 0) + 1;
  }

  const handleSave = async (id) => {
    try {
      await api.categories.update(id, form);
      toast.success('Category updated');
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      await api.categories.create(form);
      toast.success('Category created');
      setShowAdd(false);
      setForm({ name: '', description: '', icon: 'Briefcase', color: 'text-blue-600 bg-blue-100', accent: 'bg-blue-500', accent_bg: 'bg-blue-50' });
      load();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to create');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Opportunities in this category will have their category cleared.')) return;
    try {
      await api.categories.delete(id);
      toast.success('Category deleted');
      load();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to delete');
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description || '', icon: cat.icon || 'Briefcase', color: cat.color || 'text-blue-600 bg-blue-100', accent: cat.accent || 'bg-blue-500', accent_bg: cat.accent_bg || 'bg-blue-50' });
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-heading">Categories</h1>
        {!showAdd && (
          <Button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: '', description: '', icon: 'Briefcase', color: 'text-blue-600 bg-blue-100', accent: 'bg-blue-500', accent_bg: 'bg-blue-50' }); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        )}
      </div>

      {showAdd && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 space-y-2">
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Category name" className="font-medium" />
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate}><Check className="w-4 h-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="text-sm border rounded-md px-2 py-1 bg-background">
                {iconOptions.map(io => <option key={io} value={io}>{io}</option>)}
              </select>
              <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="text-sm border rounded-md px-2 py-1 bg-background">
                {colorOptions.map(co => <option key={co.value} value={co.value}>{co.label}</option>)}
              </select>
              <select value={form.accent} onChange={e => {
                const opt = accentOptions.find(a => a.accent === e.target.value);
                setForm(f => ({ ...f, accent: opt.accent, accent_bg: opt.accent_bg }));
              }} className="text-sm border rounded-md px-2 py-1 bg-background">
                {accentOptions.map(ao => <option key={ao.accent} value={ao.accent}>{ao.label} column</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map(cat => {
          const Icon = iconMap[cat.icon] || Briefcase;
          const count = counts[cat.name] || 0;
          const isEditing = editingId === cat.id;

          if (isEditing) {
            return (
              <Card key={cat.id} className="border-primary/30">
                <CardContent className="p-4 space-y-2">
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-medium" />
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm" placeholder="Description" />
                  <div className="flex gap-2 flex-wrap">
                    <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="text-xs border rounded px-2 py-1 bg-background">
                      {iconOptions.map(io => <option key={io} value={io}>{io}</option>)}
                    </select>
                    <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="text-xs border rounded px-2 py-1 bg-background">
                      {colorOptions.map(co => <option key={co.value} value={co.value}>{co.label}</option>)}
                    </select>
                    <select value={form.accent} onChange={e => {
                      const opt = accentOptions.find(a => a.accent === e.target.value);
                      setForm(f => ({ ...f, accent: opt.accent, accent_bg: opt.accent_bg }));
                    }} className="text-xs border rounded px-2 py-1 bg-background">
                      {accentOptions.map(ao => <option key={ao.accent} value={ao.accent}>{ao.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Button size="sm" onClick={() => handleSave(cat.id)}><Check className="w-3 h-3 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={cat.id} className="group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{cat.name}</p>
                  {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                  <p className="text-sm text-muted-foreground">{count} opportunity{count !== 1 ? 'ies' : 'y'}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <Link to={`/admin-bridgejobs/opportunities?category=${cat.name}`} className="shrink-0">
                  <ArrowRight className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
