import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink, Search, List, BookOpen, Pencil, Check, X, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLists() {
  const [lists, setLists] = useState([]);
  const [allOpportunities, setAllOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedList, setExpandedList] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const loadLists = async () => {
    try {
      const data = await api.lists.list();
      setLists(data);
    } catch {
      toast.error('Failed to load lists');
    }
  };

  const loadOpportunities = async () => {
    try {
      const data = await api.opportunities.list({ all: true });
      setAllOpportunities(data);
    } catch {
      toast.error('Failed to load opportunities');
    }
  };

  useEffect(() => {
    Promise.all([loadLists(), loadOpportunities()]).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.lists.create({ name: newName.trim(), description: newDesc.trim() });
      toast.success('List created!');
      setNewName('');
      setNewDesc('');
      await loadLists();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this list? The opportunities inside it will NOT be deleted.')) return;
    try {
      await api.lists.delete(id);
      toast.success('List deleted');
      setLists(prev => prev.filter(l => l.id !== id));
      if (expandedList === id) setExpandedList(null);
    } catch (err) {
      toast.error(err.data?.error || 'Failed to delete');
    }
  };

  const handleUpdate = async (id) => {
    if (!editForm.name.trim()) return;
    try {
      await api.lists.update(id, { name: editForm.name.trim(), description: editForm.description.trim() });
      toast.success('List updated');
      setEditingId(null);
      await loadLists();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to update');
    }
  };

  const startEdit = (list) => {
    setEditingId(list.id);
    setEditForm({ name: list.name, description: list.description || '' });
  };

  const handleAddItem = async (listId, oppId) => {
    try {
      await api.lists.addItem(listId, oppId);
      toast.success('Opportunity added to list');
      const updated = await api.lists.get(listId);
      setLists(prev => prev.map(l => l.id === listId ? { ...l, items: updated.items } : l));
    } catch (err) {
      toast.error(err.data?.error || 'Failed to add');
    }
  };

  const handleRemoveItem = async (listId, itemId) => {
    try {
      await api.lists.removeItem(listId, itemId);
      toast.success('Opportunity removed from list');
      const updated = await api.lists.get(listId);
      setLists(prev => prev.map(l => l.id === listId ? { ...l, items: updated.items } : l));
    } catch (err) {
      toast.error(err.data?.error || 'Failed to remove');
    }
  };

  const handleListMoveUp = async (index) => {
    if (index <= 0) return;
    try {
      const current = lists[index];
      const above = lists[index - 1];
      const currentOrder = current.sort_order ?? 0;
      const aboveOrder = above.sort_order ?? 0;
      await api.lists.update(current.id, { sort_order: aboveOrder });
      await api.lists.update(above.id, { sort_order: currentOrder });
      await loadLists();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to reorder');
    }
  };

  const handleListMoveDown = async (index) => {
    if (index >= lists.length - 1) return;
    try {
      const current = lists[index];
      const below = lists[index + 1];
      const currentOrder = current.sort_order ?? 0;
      const belowOrder = below.sort_order ?? 0;
      await api.lists.update(current.id, { sort_order: belowOrder });
      await api.lists.update(below.id, { sort_order: currentOrder });
      await loadLists();
    } catch (err) {
      toast.error(err.data?.error || 'Failed to reorder');
    }
  };

  const handleItemMoveUp = async (list, index) => {
    const items = list.items || [];
    if (index <= 0) return;
    try {
      const current = items[index];
      const above = items[index - 1];
      const currentOrder = current.list_sort_order ?? 0;
      const aboveOrder = above.list_sort_order ?? 0;
      await api.lists.reorderItem(list.id, current.list_item_id, aboveOrder);
      await api.lists.reorderItem(list.id, above.list_item_id, currentOrder);
      const updated = await api.lists.get(list.id);
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, items: updated.items } : l));
    } catch (err) {
      toast.error(err.data?.error || 'Failed to reorder');
    }
  };

  const handleItemMoveDown = async (list, index) => {
    const items = list.items || [];
    if (index >= items.length - 1) return;
    try {
      const current = items[index];
      const below = items[index + 1];
      const currentOrder = current.list_sort_order ?? 0;
      const belowOrder = below.list_sort_order ?? 0;
      await api.lists.reorderItem(list.id, current.list_item_id, belowOrder);
      await api.lists.reorderItem(list.id, below.list_item_id, currentOrder);
      const updated = await api.lists.get(list.id);
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, items: updated.items } : l));
    } catch (err) {
      toast.error(err.data?.error || 'Failed to reorder');
    }
  };

  const toggleExpand = async (listId) => {
    if (expandedList === listId) {
      setExpandedList(null);
      return;
    }
    try {
      const data = await api.lists.get(listId);
      setLists(prev => prev.map(l => l.id === listId ? { ...l, items: data.items } : l));
      setExpandedList(listId);
    } catch {
      toast.error('Failed to load list items');
    }
  };

  const filteredOpps = allOpportunities.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.title?.toLowerCase().includes(q) || o.category?.toLowerCase().includes(q);
  });

  const getItemsForList = (list) => list.items || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Curated Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage featured opportunity collections for the homepage</p>
        </div>
      </div>

      {/* Create new list */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create New List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="List name (e.g. Top Picks, Fully Funded)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      {lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No lists yet. Create your first curated list above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map((list, listIndex) => {
            const items = getItemsForList(list);
            const isExpanded = expandedList === list.id;
            const isEditing = editingId === list.id;

            return (
              <Card key={list.id} className="overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpand(list.id)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    {isEditing ? (
                      <div className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                        <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm flex-1" />
                        <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-8 text-sm flex-1" placeholder="Description" />
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="default" className="h-8" onClick={() => handleUpdate(list.id)}><Check className="w-3 h-3 mr-1" /> Save</Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <h3 className="font-semibold">{list.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {list.description || 'No description'}
                          {items.length > 0 && <span className="ml-2">· {items.length} items</span>}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{list.slug}</Badge>
                    {!isEditing && (
                      <>
                        <Button variant="ghost" size="icon" className="w-7 h-7" disabled={listIndex === 0} onClick={() => handleListMoveUp(listIndex)}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" disabled={listIndex === lists.length - 1} onClick={() => handleListMoveDown(listIndex)}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(list)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(list.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t">
                    {/* Items in this list */}
                    <div className="p-4 bg-muted/20">
                      <h4 className="text-sm font-medium mb-3">Opportunities in this list ({items.length})</h4>
                        {items.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No opportunities yet. Add some from below.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item, itemIndex) => {
                              const listItemId = item.list_item_id;
                              const displayId = listItemId || item.id;
                              return (
                                <div key={displayId} className="flex items-center justify-between gap-3 bg-card rounded-lg border px-3 py-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{item.title}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.category}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="w-7 h-7" disabled={itemIndex === 0} onClick={() => handleItemMoveUp(list, itemIndex)}>
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" disabled={itemIndex === items.length - 1} onClick={() => handleItemMoveDown(list, itemIndex)}>
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </Button>
                                    <a href={`/opportunities/${item.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground">
                                      <Eye className="w-3.5 h-3.5" />
                                    </a>
                                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleRemoveItem(list.id, listItemId || item.id)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>

                    {/* Add opportunities */}
                    <div className="p-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search opportunities to add..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5">
                        {filteredOpps.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No opportunities found</p>
                        ) : (
                          filteredOpps.map(opp => {
                            const alreadyInList = items.some(item => item.id === opp.id);
                            return (
                              <div key={opp.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm truncate">{opp.title}</span>
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">{opp.category}</Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant={alreadyInList ? "ghost" : "outline"}
                                  disabled={alreadyInList}
                                  className="h-7 text-xs shrink-0"
                                  onClick={() => handleAddItem(list.id, opp.id)}
                                >
                                  {alreadyInList ? 'Added' : 'Add'}
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
