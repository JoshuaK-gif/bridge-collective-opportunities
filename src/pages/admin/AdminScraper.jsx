import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { RefreshCw, Globe, Twitter, Linkedin, Facebook, Instagram, MessageCircle, ExternalLink, Clock, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_ICONS = { twitter: Twitter, linkedin: Linkedin, facebook: Facebook, instagram: Instagram, whatsapp: MessageCircle };

export default function AdminScraper() {
  const [posts, setPosts] = useState({ unprocessed: [], published: [] });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsData, logsData] = await Promise.all([
        api.scraper.posts(),
        api.scraper.logs(),
      ]);
      setPosts(postsData);
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
      toast.success(`Found ${data.count} new posts from OFY`);
      loadData();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Auto-Publish</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scrape from <span className="font-medium">opportunitiesforyouth.org</span>, rewrite, and publish
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Unprocessed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{posts.unprocessed.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{posts.published.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Source</CardTitle></CardHeader>
          <CardContent><p className="text-sm font-medium truncate">opportunitiesforyouth.org</p></CardContent>
        </Card>
      </div>

      {/* Unprocessed */}
      {posts.unprocessed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Posts to Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {posts.unprocessed.map(post => (
              <div key={post.source_id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{post.source_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{post.source_category || 'Uncategorized'}</Badge>
                    <span className="text-xs text-muted-foreground">{post.source_url ? new URL(post.source_url).hostname : ''}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleProcess(post.source_id)} disabled={processing === post.source_id}>
                  {processing === post.source_id ? 'Processing...' : 'Process & Publish'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Published */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Published Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.published.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No posts published yet</p>
          ) : (
            <div className="space-y-2">
              {posts.published.slice(0, 20).map(post => (
                <div key={post.source_id} className="flex items-center justify-between gap-4 p-3 rounded-lg border text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{post.opp_title || post.source_title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Website</span>
                      {post.posted_to_twitter && <span className="flex items-center gap-1"><Twitter className="w-3 h-3" /> Twitter</span>}
                      {post.posted_to_linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" /> LinkedIn</span>}
                      {post.posted_to_facebook && <span className="flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</span>}
                      {post.posted_to_instagram && <span className="flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</span>}
                      {post.posted_to_whatsapp && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {post.posted_date ? new Date(post.posted_date).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
