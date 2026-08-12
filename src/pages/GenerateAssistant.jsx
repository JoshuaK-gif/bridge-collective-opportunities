import { useState } from 'react';
import { Sparkles, Lightbulb, Target, ArrowLeft, ExternalLink, FileText, Globe, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { api } from '@/api/client';

export default function GenerateAssistant() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organization, setOrganization] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTips = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Enter an opportunity title'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.ai.applicationAssist({
        title: title.trim(), category: category.trim(), organization: organization.trim(),
        deadline: deadline.trim(), description: description.trim(),
      });
      if (res.error) { toast.error(res.error); }
      else if (!res.tips?.length) { toast.error('AI unavailable - configure AI in admin settings'); }
      else { setResult({ type: 'tips', ...res }); }
    } catch (err) { toast.error(err?.message || 'Failed to get tips'); }
    finally { setLoading(false); }
  };

  const handleWrite = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Enter an opportunity title'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.ai.grantWrite({
        title: title.trim(), category: category.trim(), organization: organization.trim(),
        deadline: deadline.trim(), description: description.trim(),
        requirements: requirements.trim(), additionalInfo: additionalInfo.trim(),
      });
      if (res.error) { toast.error(res.error); }
      else if (!res.draft) { toast.error('AI unavailable - configure AI in admin settings'); }
      else { setResult({ type: 'write', ...res }); }
    } catch (err) { toast.error(err?.message || 'Failed to write grant'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <SEO title="BCO Grant Assistant" description="Generate grant applications with AI-powered web research." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Button variant="default" size="sm" asChild className="mb-4">
            <Link to="/ai-assistant" className="gap-1.5">
              <ArrowLeft className="w-5 h-5" /> Back to tools
            </Link>
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Wand2 className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900">BCO Grant Assistant — Generate</h1>
          </div>
          <p className="text-base text-gray-500 mb-6 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-blue-500" />
            AI researches related opportunities globally before writing
          </p>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Opportunity Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mastercard Foundation Scholars Program" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-12 text-base rounded-lg border border-gray-200 px-3 bg-white">
                  <option value="">Select...</option>
                  <option value="Scholarship">Scholarship</option>
                  <option value="Grant">Grant</option>
                  <option value="Job">Job</option>
                  <option value="Internship">Internship</option>
                  <option value="Fellowship">Fellowship</option>
                  <option value="Training">Training</option>
                  <option value="Volunteer">Volunteer</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="e.g. Mastercard Foundation" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Deadline</label>
                <Input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="e.g. 2026-10-15" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className="w-full text-base text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Paste the opportunity description here..." />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Eligibility / Requirements</label>
              <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} className="w-full text-base text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="List the eligibility criteria and requirements..." />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Additional Information</label>
              <textarea value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} rows={3} className="w-full text-base text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Any other relevant details about yourself or your project..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" disabled={loading || !title.trim()} onClick={handleTips} className="gap-2">
                <Lightbulb className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Getting tips...' : 'Get Tips'}
              </Button>
              <Button type="button" disabled={loading || !title.trim()} onClick={handleWrite} className="gap-2">
                <Wand2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Researching & writing...' : 'Generate'}
              </Button>
            </div>

            {loading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Researching web & writing...</p>
              </div>
            )}

            {result?.type === 'tips' && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-4 shadow-sm">
                <h3 className="text-base font-bold flex items-center gap-2 text-purple-700 mb-3">
                  <Sparkles className="w-4 h-4" /> Application Tips
                </h3>
                {result.tips?.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {result.tips.map((tip, i) => (
                      <li key={i} className="text-base text-gray-700 flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          <Lightbulb className="w-3 h-3" />
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
                {result.keyAdvice && (
                  <div className="bg-white/60 rounded-lg p-3 border border-purple-100 mb-2">
                    <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3" /> Key Advice
                    </p>
                    <p className="text-sm text-gray-600">{result.keyAdvice}</p>
                  </div>
                )}
                {result.suggestedApproach && (
                  <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                    <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3" /> Suggested Approach
                    </p>
                    <p className="text-sm text-gray-600">{result.suggestedApproach}</p>
                  </div>
                )}
              </div>
            )}

            {result?.type === 'write' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-4 shadow-sm">
                  <h3 className="text-base font-bold flex items-center gap-2 text-blue-700 mb-3">
                    <Globe className="w-4 h-4" /> Web Research
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{result.researchSummary}</p>
                  {result.sources?.length > 0 && (
                    <ul className="space-y-1.5">
                      {result.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{s.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {result.keyStrategies?.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
                    <h3 className="text-base font-bold flex items-center gap-2 text-amber-700 mb-2">
                      <Lightbulb className="w-4 h-4" /> Key Strategies from Winners
                    </h3>
                    <ul className="space-y-1.5">
                      {result.keyStrategies.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="text-base font-bold flex items-center gap-2 text-gray-800 mb-3">
                    <FileText className="w-4 h-4" /> Grant Draft
                  </h3>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {result.draft}
                  </div>
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => {
                    navigator.clipboard.writeText(result.draft);
                    toast.success('Draft copied to clipboard!');
                  }}>
                    Copy Draft
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
