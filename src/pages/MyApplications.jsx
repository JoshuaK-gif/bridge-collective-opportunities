import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowLeft, Calendar, Briefcase } from 'lucide-react';
import SEO from '@/components/SEO';
import { useApplicationTracker } from '@/hooks/useApplicationTracker';
import DeadlineBadge from '@/components/DeadlineBadge';

const STATUS_COLORS = {
  Applied: { bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-700', label: 'Applied' },
  Shortlisted: { bg: 'bg-yellow-50', dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'Shortlisted' },
  Accepted: { bg: 'bg-green-50', dot: 'bg-green-500', text: 'text-green-700', label: 'Accepted' },
  Rejected: { bg: 'bg-red-50', dot: 'bg-red-500', text: 'text-red-700', label: 'Rejected' },
};

export default function MyApplications() {
  const { getAllApplications, setStatus, STATUSES } = useApplicationTracker();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const applications = getAllApplications();
  const appIds = Object.keys(applications);

  useEffect(() => {
    if (appIds.length === 0) {
      setLoading(false);
      setOpportunities([]);
      return;
    }
    Promise.all(
      appIds.map((id) =>
        api.opportunities.get(id).then((opp) => ({ ...opp, appStatus: applications[id] })).catch(() => null)
      )
    ).then((results) => {
      setOpportunities(results.filter(Boolean));
      setLoading(false);
    });
  }, [appIds.length]);

  const grouped = {
    Applied: opportunities.filter((o) => o.appStatus?.status === 'Applied'),
    Shortlisted: opportunities.filter((o) => o.appStatus?.status === 'Shortlisted'),
    Accepted: opportunities.filter((o) => o.appStatus?.status === 'Accepted'),
    Rejected: opportunities.filter((o) => o.appStatus?.status === 'Rejected'),
  };

  return (
    <>
      <SEO title="My Applications" description="Track your job and opportunity applications on Bridge Collective." />
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
              <span className="text-sm text-gray-400">({appIds.length} total)</span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : appIds.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-gray-700 mb-2">No applications tracked yet</h2>
                <p className="text-sm text-gray-500 mb-4">Apply to opportunities and track your progress here.</p>
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  Browse opportunities
                </Link>
              </div>
            ) : (
              <div className="space-y-8">
                {STATUSES.map((status) => {
                  const items = grouped[status];
                  if (items.length === 0) return null;
                  const colors = STATUS_COLORS[status];
                  return (
                    <div key={status}>
                      <div className={`flex items-center gap-2 mb-3 ${colors.text}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                        <h2 className="text-sm font-bold uppercase tracking-wider">{status}</h2>
                        <span className="text-xs opacity-60">({items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`${colors.bg} rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow`}
                          >
                            <Link to={`/opportunities/${item.id}`} className="flex items-center gap-4 p-4 group">
                              <div className={`w-10 h-10 rounded-lg ${colors.dot} bg-opacity-20 flex items-center justify-center shrink-0`}>
                                <CheckCircle2 className={`w-5 h-5 ${colors.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/80 text-gray-600">{item.category}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors.text} bg-white/80`}>{status}</span>
                                </div>
                                <h3 className="text-sm font-bold leading-snug line-clamp-1 group-hover:text-primary transition-colors mt-1">{item.title}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  {item.deadline && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <Calendar className="w-3 h-3" /> {item.deadline}
                                    </span>
                                  )}
                                  {item.deadline && <DeadlineBadge deadline={item.deadline} />}
                                  <span className="text-xs text-gray-400 ml-auto">
                                    Updated {new Date(item.appStatus?.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {appIds.length > 0 && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    if (window.confirm('Clear all tracked applications? This cannot be undone.')) {
                      appIds.forEach((id) => setStatus(id, null));
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
                >
                  Clear all applications
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}
