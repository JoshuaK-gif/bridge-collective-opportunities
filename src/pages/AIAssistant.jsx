import { Sparkles, Wand2, Edit3, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

const tools = [
  {
    to: '/ai-assistant/generate',
    icon: Wand2,
    color: 'blue',
    title: 'Generate Grant Application',
    desc: 'Enter opportunity details and get AI-generated grant applications with web research.',
  },
  {
    to: '/ai-assistant/polish',
    icon: Edit3,
    color: 'purple',
    title: 'Polish Text',
    desc: 'Polish existing text — choose section type and tone for the perfect draft.',
  },
];

export default function AIAssistant() {
  return (
    <>
      <SEO title="BCO Grant Assistant" description="AI-powered tools for grant applications — generate and polish with AI." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="default" size="sm" asChild className="mb-4">
            <Link to="/" className="gap-1.5">
              <ArrowLeft className="w-5 h-5" /> Back to home
            </Link>
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-bold text-gray-900">BCO Grant Assistant</h1>
          </div>
          <p className="text-base text-gray-500 mb-8">Choose a tool below to get started.</p>

          <div className="grid gap-4">
            {tools.map(t => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all hover:border-${t.color}-200 flex items-center gap-5`}
                >
                  <div className={`w-14 h-14 rounded-xl bg-${t.color}-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-7 h-7 text-${t.color}-500`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{t.title}</h2>
                    <p className="text-base text-gray-500 mt-1">{t.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
