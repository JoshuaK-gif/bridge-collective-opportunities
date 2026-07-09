import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@/api/client';
import { oppImageSrc, CATEGORY_STYLES } from '@/lib/images';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Calendar, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import RelatedOpportunities from '@/components/RelatedOpportunities';

// Utility: strip HTML tags from a string (client-side only)
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opp, setOpp] = useState(null);

  useEffect(() => {
    api.opportunities.get(id).then(setOpp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

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
      : `https://bridgejobs.ug${opp.image_url}`
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
    'url': `https://bridgejobs.ug/opportunities/${opp.id}`,
    'image': imageUrl || 'https://bridgejobs.ug/BCO.png',
    'provider': {
      '@type': 'Organization',
      'name': opp.organization || 'Bridge Collective Opportunities',
      'sameAs': opp.link || 'https://bridgejobs.ug'
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
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://bridgejobs.ug/' },
      { '@type': 'ListItem', 'position': 2, 'name': `${opp.category} Opportunities`, 'item': `https://bridgejobs.ug/category/${opp.category?.toLowerCase()}` },
      { '@type': 'ListItem', 'position': 3, 'name': opp.title, 'item': `https://bridgejobs.ug/opportunities/${opp.id}` }
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
      <div className="min-h-screen bg-gradient-to-b from-primary/[0.03] to-background">
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to opportunities
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="relative aspect-[5/3] md:aspect-[5/2] bg-muted overflow-hidden">
                {opp.image_url ? (
                  <img src={oppImageSrc(opp, 'detail')} alt={opp.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${(CATEGORY_STYLES[opp.category] || CATEGORY_STYLES.Scholarship).bg} flex items-center justify-center`}>
                    <span className="text-6xl opacity-30">{(CATEGORY_STYLES[opp.category] || CATEGORY_STYLES.Scholarship).icon}</span>
                  </div>
                )}
              </div>
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="text-sm px-3 py-1">{opp.category}</Badge>
                  {opp.deadline && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" /> Deadline: <strong>{opp.deadline}</strong>
                    </span>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-bold font-heading leading-tight">{opp.title}</h1>

                <div className="prose prose-gray dark:prose-invert max-w-none leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: opp.description }} />

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <a href={opp.link} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="lg" className="w-full gap-2 text-base">
                      <ExternalLink className="w-4 h-4" /> Apply Now
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={async () => {
                      const shareData = {
                        title: opp.title,
                        text: `Check out this opportunity: ${opp.title}`,
                        url: window.location.href,
                      };
                      if (navigator.share) {
                        try {
                          await navigator.share(shareData);
                        } catch {
                          // user cancelled
                        }
                      } else {
                        await navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied to clipboard!');
                      }
                    }}
                    className="gap-2"
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
