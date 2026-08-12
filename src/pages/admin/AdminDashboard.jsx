import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Tags, Activity, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    api.opportunities.list({ all: true }).then(setOpportunities);
  }, []);

  const pending = opportunities.filter(o => o.status === 'pending');

  const stats = [
    { label: 'Total Opportunities', value: opportunities.length, icon: Briefcase, color: 'text-blue-600 bg-blue-100' },
    { label: 'Pending Submissions', value: pending.length, icon: Activity, color: 'text-amber-600 bg-amber-100', link: '/admin-bridgejobs/opportunities?status=pending' },
    { label: 'Active', value: opportunities.filter(o => o.status === 'active').length, icon: Activity, color: 'text-purple-600 bg-purple-100' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.link || '/admin-bridgejobs/opportunities'}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow group ${s.label === 'Pending Submissions' && s.value > 0 ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {pending.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                Pending Submissions
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {pending.slice(0, 5).map(opp => {
                  const submitter = opp.structured_data?.submitted_by || 'Anonymous';
                  return (
                    <div key={opp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{opp.title}</p>
                        <p className="text-xs text-muted-foreground">From: {submitter} · {opp.category}</p>
                      </div>
                      <Link to={`/admin-bridgejobs/opportunities/${opp.id}/edit`} className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1">
                        Review <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}
                {pending.length > 5 && (
                  <Link to="/admin-bridgejobs/opportunities?status=pending" className="block text-center text-sm text-muted-foreground hover:text-primary py-2 mt-2">
                    View all {pending.length} submissions
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Active Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunities.filter(o => o.status === 'active').length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No active opportunities yet</p>
            ) : (
              <div className="space-y-2">
                {opportunities.filter(o => o.status === 'active').slice(0, 5).map(opp => (
                  <div key={opp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{opp.title}</p>
                      <p className="text-xs text-muted-foreground">{opp.category} {opp.deadline ? `· Due ${opp.deadline}` : ''}</p>
                    </div>
                    <Link to={`/admin-bridgejobs/opportunities/${opp.id}/edit`} className="text-sm text-primary hover:underline flex items-center gap-1">
                      Edit <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
