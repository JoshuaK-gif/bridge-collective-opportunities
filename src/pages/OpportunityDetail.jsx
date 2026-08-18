import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@/api/client';
import { oppImageSrc, CATEGORY_STYLES } from '@/lib/images';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ExternalLink, Calendar, Share2, CheckCircle2, Bell, Mail, Sparkles, Lightbulb, Target } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import RelatedOpportunities from '@/components/RelatedOpportunities';
import DeadlineBadge from '@/components/DeadlineBadge';
import BookmarkButton from '@/components/BookmarkButton';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useApplicationTracker } from '@/hooks/useApplicationTracker';

// Utility: strip HTML tags from a string (client-side only)
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const allowed = ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'img', 'hr', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sub', 'sup', 'u', 's', 'mark'];
  const attrs = ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'];
  function clean(node) {
    if (node.nodeType === 1) {
      if (!allowed.includes(node.tagName.toLowerCase())) {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) fragment.appendChild(node.firstChild);
        node.parentNode.replaceChild(fragment, node);
        return;
      }
      const attrsToRemove = [];
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        if (!attrs.includes(attr.name)) { attrsToRemove.push(attr.name); continue; }
        if (attr.name === 'href' || attr.name === 'src') {
          const val = attr.value.toLowerCase();
          if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) {
            attrsToRemove.push(attr.name);
          }
        }
      }
      attrsToRemove.forEach(a => node.removeAttribute(a));
      Array.from(node.childNodes).forEach(clean);
    }
  }
  Array.from(div.childNodes).forEach(clean);
  return div.innerHTML;
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opp, setOpp] = useState(null);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { getStatus, setStatus, STATUSES } = useApplicationTracker();

  useEffect(() => {
    api.opportunities.get(id).then(setOpp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const appStatus = getStatus(id);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderSent, setReminderSent] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [aiTips, setAiTips] = useState(null);
  const [loadingTips, setLoadingTips] = useState(false);

  if (!opp) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Strip HTML for plain-text description
  const plainDesc = opp.description
    ? stripHtml(opp.description).slice(0, 200)
    : `Apply for ${opp.title} — a ${opp.category} opportunity.`;
  const imageUrl = opp.image_url
    ? opp.image_url.startsWith('http')
      ? opp.image_url
      : `https://bridgecollectiveopport.org${opp.image_url}`
    : undefined;

  // Generate Google Jobs / Schema.org JSON-LD structured data
  const opportunitySchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    'title': opp.title,
    'description': stripHtml(opp.description).slice(0, 2000),
    'datePosted': opp.created_at || opp.published_at || new Date().toISOString().split('T')[0],
    'identifier': {
      '@type': 'PropertyValue',
      'name': 'Bridge Collective Opportunities',
      'value': `bridge-${opp.id}`
    },
    'url': `https://bridgecollectiveopport.org/opportunities/${opp.id}`,
    'image': imageUrl || 'https://res.cloudinary.com/et33rup2/image/upload/c_pad,w_1200,h_630,b_rgb:0f5e9e/v1786959015/BCO.png',
    'provider': {
      '@type': 'Organization',
      'name': opp.organization || 'Bridge Collective Opportunities',
      'sameAs': opp.link || 'https://bridgecollectiveopport.org'
    }
  };

  // Only add deadline if it exists
  if (opp.deadline) {
    opportunitySchema['validThrough'] = opp.deadline;
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://bridgecollectiveopport.org/' },
      { '@type': 'ListItem', 'position': 2, 'name': `${opp.category} Opportunities`, 'item': `https://bridgecollectiveopport.org/category/${opp.category?.toLowerCase()}` },
      { '@type': 'ListItem', 'position': 3, 'name': opp.title, 'item': `https://bridgecollectiveopport.org/opportunities/${opp.id}` }
    ]
  };

  return (
    <>
      <SEO
        title={opp.title}
        description={plainDesc}
        image={imageUrl}
        type="article"
        schema={[opportunitySchema, breadcrumbSchema]}
        publishedTime={opp.created_at || opp.published_at}
        keywords={`${opp.category?.toLowerCase() || 'opportunity'}, ${opp.title}, Uganda opportunities, youth careers`}
      />
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            <Button variant="default" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to opportunities
              </Link>
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="relative aspect-[5/3] md:aspect-[5/2] bg-muted overflow-hidden">
                {opp.image_url ? (
                  <img src={oppImageSrc(opp, 'detail')} alt={opp.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${(CATEGORY_STYLES[opp.category] || CATEGORY_STYLES.Scholarship).bg} flex items-center justify-center`}>
                    <span className="text-6xl opacity-30">{(CATEGORY_STYLES[opp.category] || CATEGORY_STYLES.Scholarship).icon}</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 z-10">
                  <BookmarkButton
                    isBookmarked={isBookmarked(id)}
                    onToggle={() => toggleBookmark(id)}
                    size="md"
                    className="shadow-md"
                  />
                </div>
              </div>
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="text-sm px-3 py-1">{opp.category}</Badge>
                  {opp.deadline && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Calendar className="w-4 h-4" /> Deadline: <strong>{opp.deadline}</strong>
                    </span>
                  )}
                  {opp.deadline && <DeadlineBadge deadline={opp.deadline} />}
                </div>

                <h1 className="text-2xl md:text-3xl font-bold font-heading leading-tight text-gray-900">{opp.title}</h1>

                <div className="prose prose-gray dark:prose-invert max-w-none leading-relaxed text-gray-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(opp.description) }} />

                {/* Deadline Reminder */}
                {opp.deadline && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2 text-gray-900">
                      <Bell className="w-4 h-4 text-amber-600" /> Get Deadline Reminder
                    </h3>
                    {reminderSent ? (
                      <p className="text-xs text-green-600 font-medium">
                        <Mail className="w-3.5 h-3.5 inline mr-1" />
                        Reminder set! We'll email you 48 hours before the deadline.
                      </p>
                    ) : (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!reminderEmail) return;
                            setSendingReminder(true);
                            try {
                              await api.reminders.create({
                                email: reminderEmail,
                                opportunityId: id,
                                opportunityTitle: opp.title,
                                deadline: opp.deadline,
                              });
                              setReminderSent(true);
                              toast.success('Reminder set!');
                            } catch {
                              toast.error('Failed to set reminder');
                            } finally {
                              setSendingReminder(false);
                            }
                          }}
                          className="flex gap-2"
                        >
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={reminderEmail}
                            onChange={(e) => setReminderEmail(e.target.value)}
                            required
                            className="flex-1 h-9 text-sm bg-white border-amber-300"
                          />
                          <Button type="submit" size="sm" disabled={sendingReminder} className="h-9 shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
                            <Bell className="w-3.5 h-3.5" />
                          </Button>
                        </form>
                    )}
                  </div>
                )}

                {/* Application Tracker */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Track Your Application
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((status) => {
                      const isActive = appStatus?.status === status;
                      const statusColors = {
                        Applied: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 ring-blue-400',
                        Shortlisted: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200 ring-yellow-400',
                        Accepted: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 ring-green-400',
                        Rejected: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200 ring-red-400',
                      };
                      return (
                        <button
                          key={status}
                          onClick={() => setStatus(id, isActive ? null : status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isActive
                              ? `${statusColors[status]} ring-2 ring-offset-1`
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {status} {isActive && '✓'}
                        </button>
                      );
                    })}
                  </div>
                  {appStatus && (
                    <p className="text-xs text-gray-600 mt-2">
                      Marked as <strong>{appStatus.status}</strong> on {new Date(appStatus.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* AI Application Assistant */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-purple-700">
                      <Sparkles className="w-4 h-4" /> AI Application Assistant
                    </h3>
                    {!aiTips && (
                      <button
                        onClick={async () => {
                          setLoadingTips(true);
                          try {
                            const result = await api.ai.applicationAssist({
                              title: opp.title,
                              category: opp.category,
                              description: opp.description,
                              deadline: opp.deadline,
                              organization: opp.organization,
                            });
                            setAiTips(result);
                            if (!result.tips?.length) toast.error('AI unavailable');
                          } catch (err) {
                            toast.error(err?.message || 'Failed to get tips');
                          } finally {
                            setLoadingTips(false);
                          }
                        }}
                        disabled={loadingTips}
                        className="px-3 py-1.5 btn-fill text-white text-xs font-medium flex items-center gap-1.5"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${loadingTips ? 'animate-spin' : ''}`} />
                        {loadingTips ? 'Analyzing...' : 'Get Tips'}
                      </button>
                    )}
                    {aiTips && (
                      <button
                        onClick={() => setAiTips(null)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {loadingTips && (
                    <div className="flex items-center gap-2 text-xs text-purple-600">
                      <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      Analyzing opportunity...
                    </div>
                  )}

                  {aiTips && aiTips.tips?.length > 0 && (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                        {aiTips.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              <Lightbulb className="w-3 h-3" />
                            </span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                      {aiTips.keyAdvice && (
                        <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                          <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1">
                            <Target className="w-3 h-3" /> Key Advice
                          </p>
                          <p className="text-xs text-gray-600">{aiTips.keyAdvice}</p>
                        </div>
                      )}
                      {aiTips.suggestedApproach && (
                        <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                          <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1">
                            <Target className="w-3 h-3" /> Suggested Approach
                          </p>
                          <p className="text-xs text-gray-600">{aiTips.suggestedApproach}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <a href={opp.link} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="lg" className="w-full gap-2 text-base">
                      <ExternalLink className="w-4 h-4" /> Apply Now
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 text-gray-900"
                  onClick={async () => {
                    const url = window.location.href;
                    const text = `Check out this opportunity: ${opp.title}\n\n${url}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: opp.title, text, url });
                        toast.success('Shared!');
                      } catch { /* cancelled */ }
                    } else {
                      try {
                        await navigator.clipboard.writeText(text);
                      } catch {
                        const ta = document.createElement('textarea');
                        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                        document.body.appendChild(ta); ta.select();
                        document.execCommand('copy'); document.body.removeChild(ta);
                      }
                      toast.success('Link copied to clipboard!');
                    }
                  }}
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          <RelatedOpportunities currentId={id} category={opp.category} />
        </div>
      </div>
    </>
  );
}
