import { useState } from 'react';
import { Sparkles, Edit3, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { api } from '@/api/client';

export default function PolishAssistant() {
  const [polishText, setPolishText] = useState('');
  const [polishSection, setPolishSection] = useState('grant application');
  const [polishTone, setPolishTone] = useState('professional');
  const [polishResult, setPolishResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePolish = async (e) => {
    e.preventDefault();
    if (!polishText.trim()) { toast.error('Enter text to polish'); return; }
    setLoading(true);
    setPolishResult(null);
    try {
      const res = await api.ai.grantPolish(polishText.trim(), polishSection, polishTone);
      if (res.error) { toast.error(res.error); }
      else if (!res.polished) { toast.error('AI unavailable - configure AI in admin settings'); }
      else { setPolishResult(res); }
    } catch (err) { toast.error(err?.message || 'Failed to polish'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <SEO title="BCO Grant Assistant" description="Polish your grant applications, essays, and more with AI." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Button variant="default" size="sm" asChild className="mb-4">
            <Link to="/ai-assistant" className="gap-1.5">
              <ArrowLeft className="w-5 h-5" /> Back to tools
            </Link>
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Edit3 className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-bold text-gray-900">BCO Grant Assistant — Polish</h1>
          </div>
          <p className="text-base text-gray-500 mb-6">Polish existing text with AI — choose your section type and tone.</p>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Section Type</label>
                <select value={polishSection} onChange={e => setPolishSection(e.target.value)} className="w-full h-12 text-base rounded-lg border border-gray-200 px-3 bg-white">
                  <option value="grant application">Grant Application</option>
                  <option value="executive summary">Executive Summary</option>
                  <option value="personal statement">Personal Statement</option>
                  <option value="project description">Project Description</option>
                  <option value="cover letter">Cover Letter</option>
                  <option value="motivation letter">Motivation Letter</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tone</label>
                <select value={polishTone} onChange={e => setPolishTone(e.target.value)} className="w-full h-12 text-base rounded-lg border border-gray-200 px-3 bg-white">
                  <option value="professional">Professional</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="concise">Concise</option>
                </select>
              </div>
            </div>

            <form onSubmit={handlePolish} className="space-y-3">
              <textarea value={polishText} onChange={e => setPolishText(e.target.value)} rows={6} className="w-full text-base text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Paste the section you want to polish..." />
              <div className="flex justify-center">
                <Button type="submit" disabled={loading || !polishText.trim()} className="gap-2">
                  <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Polishing...' : 'Polish Text'}
                </Button>
              </div>
            </form>

            {loading && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Polishing text...</p>
              </div>
            )}

            {polishResult && (
              <div className="space-y-4 mt-4">
                <div className="bg-white rounded-2xl border border-green-200 p-4 shadow-sm">
                  <h3 className="text-base font-bold flex items-center gap-2 text-green-700 mb-3">
                    <Edit3 className="w-4 h-4" /> Polished Text
                  </h3>
                  <div className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed bg-green-50 rounded-lg p-4 border border-green-100">
                    {polishResult.polished}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="gap-1.5" onClick={() => {
                      navigator.clipboard.writeText(polishResult.polished);
                      toast.success('Copied!');
                    }}>
                      Copy
                    </Button>
                  </div>
                </div>

                {polishResult.changes?.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-purple-700 mb-2">What was improved</h3>
                    <ul className="space-y-1">
                      {polishResult.changes.map((c, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                          <span className="text-purple-500 mt-0.5">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
