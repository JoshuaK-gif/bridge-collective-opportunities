import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  FileText, FileDown, Loader2, Wand2, Landmark,
  ClipboardPaste, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { api } from '@/api/client';

// Rough keyword mapping from AI-generated draft headings to pack section titles
function matchDraftHeading(heading, sections) {
  const h = heading.toLowerCase().replace(/[#*_`]/g, '').trim();
  let best = null;
  let bestScore = 0;
  for (const s of sections) {
    const titleWords = s.title.toLowerCase().replace(/^[a-z]\)\s*/, '').split(/\W+/).filter(Boolean);
    const keywords = [s.id.replace(/_/g, ' '), ...titleWords];
    let score = 0;
    for (const kw of keywords) {
      if (kw.length >= 3 && h.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore >= 4 ? best : null;
}

function splitDraftByHeadings(draft) {
  const lines = draft.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      current = { heading: h[2].trim(), body: [] };
      blocks.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return blocks.map(b => ({ heading: b.heading, text: b.body.join('\n').trim() }))
    .filter(b => b.heading || b.text);
}

export default function GrantCheckAssistant() {
  const location = useLocation();
  const navigate = useNavigate();

  const [packs, setPacks] = useState([]);
  const [engineAvailable, setEngineAvailable] = useState(true);
  const [packsLoading, setPacksLoading] = useState(true);

  const [pack, setPack] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [funderMeta, setFunderMeta] = useState(null);

  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [content, setContent] = useState({});
  const [draftText, setDraftText] = useState('');

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const [building, setBuilding] = useState(null);

  // Prefill from the Generate tool ("Check with funder rules" passes the draft)
  useEffect(() => {
    const draft = location.state?.draft;
    const oppTitle = location.state?.title;
    if (draft && typeof draft === 'string' && draft.trim()) {
      setDraftText(draft);
    }
    if (oppTitle) setTitle(oppTitle);
  }, [location.state]);

  useEffect(() => {
    api.grantkit.packs()
      .then(res => {
        setEngineAvailable(res.engineAvailable !== false);
        setPacks(res.packs || []);
        if (res.engineAvailable === false) {
          toast.error('GrantKit engine not installed on the server yet.');
        }
      })
      .catch(() => {
        setEngineAvailable(false);
        setPacks([]);
      })
      .finally(() => setPacksLoading(false));
  }, []);

  // Auto-load sections when a pack is picked
  useEffect(() => {
    if (!pack) return;
    setSectionsLoading(true);
    setResult(null);
    setContent({});
    api.grantkit.sections(pack)
      .then(res => {
        setFunderMeta({ pack: res.pack, funder: res.funder, program: res.program, locale: res.locale, accepts_markdown: res.accepts_markdown });
        setSections(res.sections || []);
      })
      .catch(err => {
        toast.error(err?.message || 'Failed to load funder sections');
        setSections([]);
      })
      .finally(() => setSectionsLoading(false));
  }, [pack]);

  const requiredCount = useMemo(() => sections.filter(s => s.required).length, [sections]);

  const applyDraft = () => {
    if (!draftText.trim()) { toast.error('Paste your draft first'); return; }
    const blocks = splitDraftByHeadings(draftText);
    if (!blocks.length) {
      toast.error('No headings found — add markdown headings (##) to your draft so it can be split into sections.');
      return;
    }
    const next = { ...content };
    let placed = 0;
    for (const block of blocks) {
      const target = matchDraftHeading(block.heading, sections);
      if (target) {
        next[target.id] = next[target.id]
          ? `${next[target.id]}\n\n${block.text}`
          : (block.heading ? `## ${block.heading}\n\n${block.text}` : block.text);
        placed++;
      } else {
        // unmatched heading — drop into the first section so nothing is lost
        const first = sections[0];
        if (first) {
          next[first.id] = next[first.id]
            ? `${next[first.id]}\n\n## ${block.heading}\n\n${block.text}`
            : `## ${block.heading}\n\n${block.text}`;
          placed++;
        }
      }
    }
    setContent(next);
    toast.success(`Split draft into sections (${placed} blocks placed). Review each section below, then run the check.`);
  };

  const handleCheck = async () => {
    if (!pack) { toast.error('Choose a funder first'); return; }
    setChecking(true);
    setResult(null);
    try {
      const res = await api.grantkit.check({
        pack,
        title: title.trim(),
        deadline: deadline.trim(),
        sections: content,
      });
      if (res.engineAvailable === false) {
        toast.error(res.error || 'GrantKit engine unavailable');
        return;
      }
      setResult(res);
    } catch (err) {
      toast.error(err?.message || 'Funder check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleBuild = async (format) => {
    if (!pack) { toast.error('Choose a funder first'); return; }
    setBuilding(format);
    try {
      const blob = await api.grantkit.build({
        pack,
        title: title.trim(),
        deadline: deadline.trim(),
        sections: content,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bco-grant-proposal.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success('Document downloaded!');
    } catch (err) {
      toast.error(err?.message || 'Build failed');
    } finally {
      setBuilding(null);
    }
  };

  const limitLabel = (s) => {
    const parts = [];
    if (s.word_limit) parts.push(`${s.word_limit} words`);
    if (s.char_limit) parts.push(`${s.char_limit} chars`);
    if (s.page_limit) parts.push(`${s.page_limit} page${s.page_limit > 1 ? 's' : ''}`);
    return parts.join(' · ');
  };

  const errorItems = result?.check?.items?.filter(i => i.level === 'error') || [];
  const warningItems = result?.check?.items?.filter(i => i.level === 'warning') || [];

  return (
    <>
      <SEO title="BCO Grant Assistant — Funder Check & Build" description="Check your grant application against real funder rules (NSF, Nuffield, PBIF) and download a formatted submission document." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="default" size="sm" asChild className="mb-4">
            <Link to="/ai-assistant" className="gap-1.5">
              <ArrowLeft className="w-5 h-5" /> Back to tools
            </Link>
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">BCO Grant Assistant — Funder Check</h1>
          </div>
          <p className="text-base text-gray-500 mb-6 flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-green-600" />
            Powered by GrantKit — lint your application against the funder's real rules, then download PDF / Word / Markdown
          </p>

          {!packsLoading && !engineAvailable && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" /> GrantKit engine not installed yet
              </h3>
              <p className="text-sm text-amber-700">
                The AI writing tools still work, but funder checking needs the GrantKit Python engine on the server.
                Ask your admin to run <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">pip install grantkit[all]</code>.
              </p>
            </div>
          )}

          {/* Step 1: Funder pack */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4 mb-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">1</span>
              Choose your funder
            </h2>
            {packsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading funder packs...
              </div>
            ) : packs.length === 0 ? (
              <p className="text-sm text-gray-500">No funder packs available yet.</p>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {packs.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPack(p.id)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      pack === p.id
                        ? 'border-green-500 ring-2 ring-green-100 bg-green-50/50'
                        : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-bold text-gray-800">{p.funder}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-snug">{p.program}</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {p.locale || 'en-US'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {pack && (
            <>
              {/* Step 2: Details */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4 mb-4">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">2</span>
                  Proposal details
                  {sectionsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-sm font-medium text-gray-700">Proposal Title</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Solar-Powered Digital Literacy for Rural Ugandan Youth" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Deadline</label>
                    <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                </div>
                {funderMeta && (
                  <p className="text-xs text-gray-400">
                    {funderMeta.funder} · {funderMeta.program} · {funderMeta.locale === 'en-GB' ? 'British English' : 'US English'}
                    {funderMeta.accepts_markdown ? ' · accepts Markdown' : ' · plain-text portal'}
                  </p>
                )}
              </div>

              {/* Step 3: Sections */}
              {!sectionsLoading && sections.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5 mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">3</span>
                      Write your sections
                      <span className="text-xs font-medium text-gray-400">({requiredCount} required)</span>
                    </h2>
                  </div>

                  {/* Paste draft helper */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                      <ClipboardPaste className="w-3.5 h-3.5" /> Have a draft from Generate or elsewhere?
                    </p>
                    <textarea
                      value={draftText}
                      onChange={e => setDraftText(e.target.value)}
                      rows={3}
                      className="w-full text-sm text-gray-900 bg-white rounded-lg border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Paste your full application with markdown headings (## Section Name) and we'll split it into the funder's sections..."
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={applyDraft} className="gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" /> Auto-split into sections
                    </Button>
                  </div>

                  {sections.map((s, i) => {
                    const words = (content[s.id] || '').trim().split(/\s+/).filter(Boolean).length;
                    const overLimit = s.word_limit && words > s.word_limit;
                    return (
                      <div key={s.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm font-semibold text-gray-700">
                            {i + 1}. {s.title}
                            {s.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${overLimit ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            {limitLabel(s)}
                            {s.word_limit && ` · ${words}/${s.word_limit}`}
                          </span>
                        </div>
                        <textarea
                          value={content[s.id] || ''}
                          onChange={e => setContent({ ...content, [s.id]: e.target.value })}
                          rows={Math.max(3, Math.min(8, Math.ceil((content[s.id] || '').length / 280)))}
                          className={`w-full text-base text-gray-900 bg-white rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${overLimit ? 'border-red-300' : 'border-gray-200'}`}
                          placeholder={`Write the ${s.title.toLowerCase()} for your proposal...`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {sectionsLoading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-center gap-2 text-sm text-gray-400 mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading funder sections...
                </div>
              )}

              {/* Actions */}
              {sections.length > 0 && (
                <div className="flex flex-wrap gap-3 items-center mb-4">
                  <Button onClick={handleCheck} disabled={checking || building} className="gap-2">
                    {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {checking ? 'Checking against funder rules...' : 'Run Funder Check'}
                  </Button>
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">Download:</span>
                    {[
                      { f: 'pdf', label: 'PDF' },
                      { f: 'docx', label: 'Word' },
                      { f: 'md', label: 'Markdown' },
                    ].map(({ f, label }) => (
                      <Button key={f} size="sm" variant="outline" onClick={() => handleBuild(f)} disabled={checking || building} className="gap-1.5">
                        {building === f ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-2xl border p-4 text-center shadow-sm ${errorItems.length ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                      <div className={`text-2xl font-black ${errorItems.length ? 'text-red-600' : 'text-green-600'}`}>{errorItems.length}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">Errors</div>
                    </div>
                    <div className={`rounded-2xl border p-4 text-center shadow-sm ${warningItems.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                      <div className={`text-2xl font-black ${warningItems.length ? 'text-amber-600' : 'text-green-600'}`}>{warningItems.length}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">Warnings</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
                      <div className="text-2xl font-black text-blue-600">
                        {result.status?.completion?.percent != null ? `${Math.round(result.status.completion.percent)}%` : '—'}
                      </div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">Complete</div>
                    </div>
                  </div>

                  {errorItems.length === 0 && warningItems.length === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3 shadow-sm">
                      <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-green-700">All checks passed!</div>
                        <div className="text-xs text-green-600">Your proposal is ready to download for submission.</div>
                      </div>
                    </div>
                  )}

                  {errorItems.length > 0 && (
                    <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4" /> Must fix before submission
                      </h3>
                      <ul className="space-y-2">
                        {errorItems.map((item, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2 bg-red-50/60 rounded-lg p-3 border border-red-100">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium">{item.message}</span>
                              {item.citation && <span className="block text-xs text-gray-400 mt-0.5">Rule source: {item.citation}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {warningItems.length > 0 && (
                    <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" /> Suggestions to strengthen
                      </h3>
                      <ul className="space-y-2">
                        {warningItems.map((item, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2 bg-amber-50/60 rounded-lg p-3 border border-amber-100">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium">{item.message}</span>
                              {item.citation && <span className="block text-xs text-gray-400 mt-0.5">Rule source: {item.citation}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.status?.sections?.some(s => s.issues?.length) && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4" /> Per-section status
                      </h3>
                      <div className="space-y-1.5">
                        {result.status.sections.map(s => (
                          <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-gray-600 truncate">{s.title}</span>
                            <span className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${
                              s.status === 'complete' ? 'bg-green-100 text-green-700' :
                              s.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {s.words ?? 0} words · {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="sm" onClick={() => setResult(null)} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Edit and re-check
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
