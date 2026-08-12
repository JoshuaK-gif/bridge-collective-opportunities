import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { RefreshCw, Globe, Twitter, Linkedin, Facebook, Instagram, MessageCircle, CheckCircle2, XCircle, Settings, FileEdit, Plus, FileText, Send, Eye, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_ICONS = { twitter: Twitter, linkedin: Linkedin, facebook: Facebook, instagram: Instagram, whatsapp: MessageCircle };

export default function AdminScraper() {
  const [allPosts, setAllPosts] = useState([]);
  const [feedPreview, setFeedPreview] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState('scrap');
  const [selectedDrafts, setSelectedDrafts] = useState(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [publishingDraft, setPublishingDraft] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [republishingId, setRepublishingId] = useState(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, status: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsData, logsData] = await Promise.all([
        api.scraper.posts(),
        api.scraper.logs(),
      ]);
      setAllPosts(postsData.all || []);
      setLogs(logsData);
    } catch {
      toast.error('Failed to load scraper data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePreview = async () => {
    try {
      const data = await api.scraper.preview();
      setFeedPreview(data.posts || []);
      setActiveTab('feed');
      toast.success(`Found ${data.count} new posts from OFY`);
    } catch {
      toast.error('Failed to fetch feed');
    }
  };

  const handleProcess = async (sourceId) => {
    setProcessing(sourceId);
    try {
      await api.scraper.process(sourceId);
      toast.success('Post processed and published');
      loadData();
    } catch {
      toast.error('Failed to process post');
    } finally {
      setProcessing(null);
    }
  };

  const handleProcessAll = async () => {
    setLoading(true);
    try {
      const data = await api.scraper.processAll();
      toast.success(`Processed ${data.processed} posts`);
      loadData();
    } catch {
      toast.error('Failed to process posts');
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeUrl = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    try {
      const result = await api.scraper.scrapeUrl(scrapeUrl.trim());
      toast.success('Page scraped! Edit the draft.');
      setScrapeUrl('');
      loadData();
    } catch {
      toast.error('Failed to scrape URL');
    } finally {
      setScraping(false);
    }
  };

  const handleEnrichAll = async () => {
    if (drafts.length === 0) return;
    setEnrichingAll(true);
    setEnrichProgress({ current: 0, total: drafts.length, status: 'Starting...' });
    let success = 0;
    let failed = 0;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      setEnrichProgress({ current: i + 1, total: drafts.length, status: d.source_title?.slice(0, 60) || 'Unknown' });
      try {
        await api.scraper.enrichDraft(d.id);
        success++;
      } catch {
        failed++;
      }
    }
    setEnrichProgress({ current: drafts.length, total: drafts.length, status: `Done — ${success} enriched, ${failed} failed` });
    setEnrichingAll(false);
    toast.success(`Enriched ${success} drafts${failed ? `, ${failed} failed` : ''}`);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Auto-Publish</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scrape from <span className="font-medium">opportunitiesforyouth.org</span>, extract structured data, and publish
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin-bridgejobs/scraper/config"><Settings className="w-4 h-4 mr-1" /> Config</Link>
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={loading}>
            <Globe className="w-4 h-4 mr-1" /> Preview Feed
          </Button>
          <Button onClick={handleProcessAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Process All New
          </Button>
        </div>
      </div>

      {/* Scrape URL */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Scrape a URL</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="https://example.com/opportunity" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleScrapeUrl()} />
            <Button onClick={handleScrapeUrl} disabled={scraping || !scrapeUrl.trim()}>
              <Plus className="w-4 h-4 mr-1" /> {scraping ? 'Scraping...' : 'Scrape'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Feed Preview</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{feedPreview.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Scrapped</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{allPosts.filter(p => !p.is_published).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{allPosts.filter(p => p.is_published).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sources</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium truncate" title="Configured in Scraper Config">
              {feedPreview.length > 0 ? `${new Set(feedPreview.map(p => p.source_feed).filter(Boolean)).size} feed(s)` : 'Configurable'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="feed" className="gap-2">
            <Globe className="w-4 h-4" /> Feed Preview
            {feedPreview.length > 0 && <Badge variant="secondary" className="ml-1">{feedPreview.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="scrap" className="gap-2">
            <FileText className="w-4 h-4" /> Scrap
            <Badge variant="secondary" className="ml-1">{allPosts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2">
            <Send className="w-4 h-4" /> Published
            <Badge variant="secondary" className="ml-1">{allPosts.filter(p => p.is_published).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Eye className="w-4 h-4" /> Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Feed Preview Tab */}
        <TabsContent value="feed" className="space-y-4">
          {feedPreview.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Globe className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Click "Preview Feed" to see new posts from opportunitiesforyouth.org</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New Posts from Feed ({feedPreview.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                  {feedPreview.map(post => (
                    <div key={post.sourceId} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{post.category || 'Uncategorized'}</Badge>
                          <span className="text-xs text-muted-foreground">{post.link ? new URL(post.link).hostname : ''}</span>
                          {post.source_feed && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {new URL(post.source_feed).hostname}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleProcess(post.sourceId)} disabled={processing === post.sourceId}>
                        {processing === post.sourceId ? 'Processing...' : 'Process & Publish'}
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Scrap Tab — all posts in one place */}
        <TabsContent value="scrap" className="space-y-4">
          {allPosts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No scrapped items yet. Scrape a URL or process feed items.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allPosts.some(p => !p.is_published) && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">{allPosts.filter(p => !p.is_published).length} unprocessed</span>
                  <Button size="sm" variant="secondary" onClick={handleEnrichAll} disabled={enrichingAll}>
                    <Sparkles className="w-3.5 h-3.5 mr-1" /> {enrichingAll ? 'Generating...' : 'Generate for All'}
                  </Button>
                  {enrichingAll && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                      {enrichProgress.current}/{enrichProgress.total} — {enrichProgress.status}
                    </div>
                  )}
                </div>
              )}
              {selectedDrafts.size > 0 && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">{selectedDrafts.size} selected</span>
                  <Button size="sm" onClick={async () => {
                    setBulkPublishing(true);
                    try {
                      const res = await api.opportunities.bulkPublish([...selectedDrafts]);
                      toast.success(`${res.published} drafts published`);
                      setSelectedDrafts(new Set());
                      loadData();
                    } catch {
                      toast.error('Bulk publish failed');
                    } finally {
                      setBulkPublishing(false);
                    }
                  }} disabled={bulkPublishing}>
                    <Send className="w-3.5 h-3.5 mr-1" /> {bulkPublishing ? 'Publishing...' : 'Publish Selected'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedDrafts(new Set())}>Clear</Button>
                </div>
              )}
              {allPosts.map(d => {
                const isPublished = d.is_published;
                const isLive = d.is_live;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {!isPublished && (
                        <input type="checkbox" checked={selectedDrafts.has(d.id)} onChange={() => {
                          setSelectedDrafts(prev => {
                            const next = new Set(prev);
                            if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                            return next;
                          });
                        }} className="rounded shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{d.edited_title || d.source_title || d.opp_title || d.raw_content?.slice(0, 80) || 'Untitled'}</p>
                          {isPublished && (
                            <Badge variant="default" className="shrink-0 bg-green-600 text-white text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Published
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.source_url ? new URL(d.source_url).hostname : ''} · {new Date(d.created_date).toLocaleDateString()}
                          {d.deadline && <span className="ml-2">Deadline: {d.deadline}</span>}
                          {d.status && <span className="ml-2 capitalize">Status: {d.status}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {isPublished ? (
                        <>
                          {isLive && (
                            <Button size="sm" variant="outline" onClick={async () => {
                              setRepublishingId(d.id);
                              try {
                                await api.scraper.republishDraft(d.id);
                                toast.success('Republished!');
                                loadData();
                              } catch {
                                toast.error('Failed to republish');
                              } finally {
                                setRepublishingId(null);
                              }
                            }} disabled={republishingId === d.id}>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> {republishingId === d.id ? 'Republishing...' : 'Republish'}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/admin-bridgejobs/opportunities?id=${d.opportunity_id}`} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </a>
                          </Button>
                          <Button size="sm" variant="destructive" onClick={async () => {
                            if (!confirm('Delete this published opportunity?')) return;
                            setDeletingId(d.id);
                            try {
                              await api.opportunities.delete(d.opportunity_id);
                              await api.scraper.deleteDraft(d.id);
                              toast.success('Deleted');
                              loadData();
                            } catch {
                              toast.error('Failed to delete');
                            } finally {
                              setDeletingId(null);
                            }
                          }} disabled={deletingId === d.id}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" onClick={async () => {
                            setPublishingDraft(d.id);
                            try {
                              await api.scraper.publishDraft(d.id);
                              toast.success('Published!');
                              loadData();
                            } catch {
                              toast.error('Failed to publish');
                            } finally {
                              setPublishingDraft(null);
                            }
                          }} disabled={publishingDraft === d.id}>
                            {publishingDraft === d.id ? 'Publishing...' : 'Publish'}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/admin-bridgejobs/scraper/drafts/${d.id}`}>
                              <FileEdit className="w-3.5 h-3.5 mr-1" /> Edit
                            </Link>
                          </Button>
                          <Button size="sm" variant="destructive" onClick={async () => {
                            if (!confirm('Delete this draft?')) return;
                            setDeletingId(d.id);
                            try {
                              await api.scraper.deleteDraft(d.id);
                              toast.success('Draft deleted');
                              loadData();
                            } catch {
                              toast.error('Failed to delete draft');
                            } finally {
                              setDeletingId(null);
                            }
                          }} disabled={deletingId === d.id}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Published Tab — filtered view */}
        <TabsContent value="published" className="space-y-4">
          {allPosts.filter(p => p.is_published).length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Send className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No posts published yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allPosts.filter(p => p.is_published).map(post => (
                <div key={post.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{post.opp_title || post.source_title || post.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Website</span>
                      {post.posted_to_twitter && <span className="flex items-center gap-1"><Twitter className="w-3 h-3" /> Twitter</span>}
                      {post.posted_to_linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" /> LinkedIn</span>}
                      {post.posted_to_facebook && <span className="flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</span>}
                      {post.posted_to_instagram && <span className="flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</span>}
                      {post.posted_to_whatsapp && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={async () => {
                      setRepublishingId(post.id);
                      try {
                        await api.scraper.republishDraft(post.id);
                        toast.success('Republished!');
                        loadData();
                      } catch {
                        toast.error('Failed to republish');
                      } finally {
                        setRepublishingId(null);
                      }
                    }} disabled={republishingId === post.id}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> {republishingId === post.id ? 'Republishing...' : 'Republish'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      if (!confirm('Delete this post?')) return;
                      setDeletingId(post.id);
                      try {
                        await api.opportunities.delete(post.opportunity_id);
                        await api.scraper.deleteDraft(post.id);
                        toast.success('Deleted');
                        loadData();
                      } catch {
                        toast.error('Failed to delete');
                      } finally {
                        setDeletingId(null);
                      }
                    }} disabled={deletingId === post.id}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {post.posted_date ? new Date(post.posted_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="logs" className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-lg">Activity Log</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium">{log.action}</span>
                        {log.details?.count && <span className="text-muted-foreground">({log.details.count} items)</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_date).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
