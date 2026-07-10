import { useState } from 'react';
import { Sparkles, Lightbulb, Target, ArrowLeft, ExternalLink, FileText, Edit3, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { api } from '@/api/client';

const TABS = [
  { id: 'tips', label: 'Get Tips', icon: Lightbulb },
  { id: 'write', label: 'Write Grant', icon: FileText },
  { id: 'polish', label: 'Polish', icon: Edit3 },
];

export default function AIAssistant() {
  const [tab, setTab] = useState('tips');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organization, setOrganization] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Polish state
  const [polishText, setPolishText] = useState('');
  const [polishSection, setPolishSection] = useState('grant application');
  const [polishTone, setPolishTone] = useState('professional');
  const [polishResult, setPolishResult] = useState(null);

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setOrganization('');
    setDeadline('');
    setDescription('');
    setRequirements('');
    setAdditionalInfo('');
    setPolishText('');
    setPolishSection('grant application');
    setPolishTone('professional');
    setPolishResult(null);
    setResult(null);
  };

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
      <SEO title="BCO Grant Assistant" description="Get AI-powered application tips, write grants, and polish your applications." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-2xl font-bold text-gray-900">BCO Grant Assistant</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">Get application tips, write grant proposals, or polish your drafts — powered by AI with web research.</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); resetForm(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-white shadow-sm border border-purple-200 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

                {/* Tips & Write Grant Form */}
                {(tab === 'tips' || tab === 'write') && (
                  <form onSubmit={tab === 'tips' ? handleTips : handleWrite} className="space-y-4">
                    <h2 className="text-lg font-bold mb-1">
                      {tab === 'tips' ? 'Opportunity Details' : 'Write a Grant Application'}
                    </h2>
                    {tab === 'write' && (
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        AI researches past winners online before writing
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-600">Opportunity Title *</label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mastercard Foundation Scholars Program" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-200 px-3 bg-white">
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
                        <label className="text-xs font-medium text-gray-600">Organization</label>
                        <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="e.g. Mastercard Foundation" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Deadline</label>
                        <Input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="e.g. 2026-10-15" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Description</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Paste the opportunity description here..." />
                    </div>
                    {tab === 'write' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Eligibility / Requirements</label>
                          <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="List the eligibility criteria and requirements..." />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Additional Information</label>
                          <textarea value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} rows={3} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Any other relevant details about yourself or your project..." />
                        </div>
                      </>
                    )}
                    <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-purple-500 to-pink-500">
                      <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? tab === 'tips' ? 'Getting tips...' : 'Researching & writing...' : tab === 'tips' ? 'Get Tips' : 'Write Grant Application'}
                    </Button>
                  </form>
                )}

                {/* Polish Form */}
                {tab === 'polish' && (
                  <form onSubmit={handlePolish} className="space-y-4">
                    <h2 className="text-lg font-bold mb-1">Polish Your Writing</h2>
                    <p className="text-xs text-gray-500 mb-3">Paste a section of your grant or application to make it more compelling.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Section Type</label>
                        <select value={polishSection} onChange={e => setPolishSection(e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-200 px-3 bg-white">
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
                        <label className="text-xs font-medium text-gray-600">Tone</label>
                        <select value={polishTone} onChange={e => setPolishTone(e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-200 px-3 bg-white">
                          <option value="professional">Professional</option>
                          <option value="persuasive">Persuasive</option>
                          <option value="concise">Concise</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Your Text *</label>
                      <textarea value={polishText} onChange={e => setPolishText(e.target.value)} rows={10} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Paste the section you want to polish..." />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-purple-500 to-pink-500">
                      <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Polishing...' : 'Polish Text'}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-4">
              {/* Tips Result */}
              {result?.type === 'tips' && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-5 shadow-sm">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-purple-700 mb-3">
                    <Sparkles className="w-4 h-4" /> Application Tips
                  </h3>
                  {result.tips?.length > 0 && (
                    <ul className="space-y-2 mb-3">
                      {result.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
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

              {/* Write Result */}
              {result?.type === 'write' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-blue-700 mb-3">
                      <Globe className="w-4 h-4" /> Web Research
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">{result.researchSummary}</p>
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
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 shadow-sm">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-amber-700 mb-2">
                        <Lightbulb className="w-4 h-4" /> Key Strategies from Winners
                      </h3>
                      <ul className="space-y-1.5">
                        {result.keyStrategies.map((s, i) => (
                          <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800 mb-3">
                      <FileText className="w-4 h-4" /> Grant Draft
                    </h3>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {result.draft}
                    </div>
                    <Button
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(result.draft);
                        toast.success('Draft copied to clipboard!');
                      }}
                    >
                      Copy Draft
                    </Button>
                  </div>
                </div>
              )}

              {/* Polish Result */}
              {polishResult && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-green-700 mb-3">
                      <Edit3 className="w-4 h-4" /> Polished Text
                    </h3>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-green-50 rounded-lg p-4 border border-green-100">
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
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-5 shadow-sm">
                      <h3 className="text-xs font-bold text-purple-700 mb-2">What was improved</h3>
                      <ul className="space-y-1">
                        {polishResult.changes.map((c, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-purple-500 mt-0.5">•</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-500">
                    {tab === 'tips' ? 'Generating tips...' :
                     tab === 'write' ? 'Researching web & writing...' :
                     'Polishing text...'}
                  </p>
                </div>
              )}

              {!loading && !result && !polishResult && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                  <Sparkles className="w-10 h-10 text-purple-300 mb-3" />
                  <p className="text-sm text-gray-400">
                    {tab === 'tips' ? 'Fill in the form and get AI tips' :
                     tab === 'write' ? 'AI will research past winners online and write a tailored grant' :
                     'Paste your text and get it polished'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
