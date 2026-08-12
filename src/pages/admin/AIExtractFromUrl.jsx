import { useState } from 'react';
import { Globe, Sparkles, Copy, Check, ExternalLink, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/api/client';
import { toast } from 'sonner';

function Field({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      {Array.isArray(value) ? (
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
          {value.filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}

export default function AIExtractFromUrl() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleExtract = async (e) => {
    e.preventDefault();
    if (!url.trim()) { toast.error('Enter a URL'); return; }
    setLoading(true);
    setResult(null);
    try {
      const data = await api.ai.extractFromUrl(url.trim());
      if (data.error) { toast.error(data.error); }
      else if (!data.structured_data || Object.keys(data.structured_data).length < 3) {
        toast.error('AI could not extract enough information from that page');
      } else {
        setResult(data);
        toast.success('Opportunity extracted successfully!');
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = JSON.stringify(result.structured_data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Structured data copied!');
  };

  const sd = result?.structured_data || {};

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          AI Opportunity Extractor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste any opportunity URL — the AI will scrape the page and extract all fields (deadline, eligibility, about, benefits, etc.) for free.
        </p>
      </div>

      <form onSubmit={handleExtract} className="flex gap-2 mb-6">
        <div className="flex-1">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/scholarship-2026"
            className="h-12 text-base"
          />
        </div>
        <Button type="submit" disabled={loading || !url.trim()} className="h-12 px-6 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Extracting...' : 'Extract'}
        </Button>
      </form>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Fetching webpage & analyzing with AI...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          {/* Title */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Extracted Title</p>
                  <h2 className="text-xl font-bold text-gray-900">{sd.title || result.title}</h2>
                  {result.url && (
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                      <ExternalLink className="w-3 h-3" /> Original source
                    </a>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary & About */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sd.short_summary && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Short Summary</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{sd.short_summary}</p></CardContent>
              </Card>
            )}
            {sd.about && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">About</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{sd.about}</p></CardContent>
              </Card>
            )}
          </div>

          {/* Key Details Grid */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Key Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {sd.organization && <Field label="Organization" value={sd.organization} />}
                {sd.opportunity_type && <Field label="Type" value={sd.opportunity_type} />}
                {sd.deadline && <Field label="Deadline" value={sd.deadline} />}
                {sd.location && <Field label="Location" value={sd.location} />}
                {sd.duration && <Field label="Duration" value={sd.duration} />}
                {sd.start_date && <Field label="Start Date" value={sd.start_date} />}
                {sd.funding && <Field label="Funding" value={sd.funding} />}
                {sd.number_of_positions && <Field label="Positions" value={sd.number_of_positions} />}
                {sd.work_mode && <Field label="Work Mode" value={sd.work_mode} />}
                {sd.eligible_countries && <Field label="Eligible Countries" value={sd.eligible_countries} />}
                {sd.eligible_applicants && <Field label="Eligible Applicants" value={sd.eligible_applicants} />}
                {sd.selection_process && <Field label="Selection Process" value={sd.selection_process} />}
                {sd.application_process && <Field label="Application Process" value={sd.application_process} />}
              </div>
            </CardContent>
          </Card>

          {/* Lists */}
          {sd.benefits?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Benefits</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.eligibility_requirements?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Eligibility Requirements</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.eligibility_requirements.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.responsibilities?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Responsibilities</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.required_documents?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Required Documents</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.required_documents.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.important_dates?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Important Dates</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.important_dates.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.tips_for_applicants?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tips for Applicants</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sd.tips_for_applicants.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {sd.keywords?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Keywords</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {sd.keywords.map((k, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">{k}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* FAQ */}
          {sd.faq?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">FAQ</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {sd.faq.filter(f => f && (f.question || f.answer)).map((f, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold text-gray-800">Q: {f.question}</p>
                    <p className="text-sm text-gray-600 mt-0.5">A: {f.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* HTML Description Preview */}
          {result.html_description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Generated HTML Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: result.html_description }} />
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => {
                  navigator.clipboard.writeText(result.html_description);
                  toast.success('HTML description copied!');
                }}>
                  <Copy className="w-3.5 h-3.5" /> Copy HTML
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && !result && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Paste an opportunity URL above and click Extract</p>
            <p className="text-xs mt-1">The AI will scrape the page and extract all structured fields for free.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}