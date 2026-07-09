import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Tags, Activity, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    api.opportunities.list().then(setOpportunities);
  }, []);

  const stats = [
    { label: 'Total Opportunities', value: opportunities.length, icon: Briefcase, color: 'text-blue-600 bg-blue-100' },
    { label: 'Categories', value: new Set(opportunities.map(o => o.category)).size, icon: Tags, color: 'text-green-600 bg-green-100', link: '/admin-bridgejobs/categories' },
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
              <Card className="cursor-pointer hover:shadow-md transition-shadow group">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No opportunities yet</p>
          ) : (
            <div className="space-y-2">
              {opportunities.slice(0, 5).map(opp => (
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
  );
}
