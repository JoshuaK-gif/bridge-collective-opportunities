import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, FileText, CheckCircle, Loader2, Sparkles, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { api } from '@/api/client';

export default function CVReview() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [fetchingAI, setFetchingAI] = useState(false);

  const handleUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    setFile(f);
    setAnalyzing(true);
    setResult(null);
    setAiSuggestions(null);

    try {
      const formData = new FormData();
      formData.append('file', f);
      const token = localStorage.getItem('bridge_jobs_token');
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      setResult(data);
      toast.success('CV analyzed!');
    } catch (err) {
      toast.error(err.message || 'Failed to analyze CV. Try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAIFeedback = async () => {
    if (!result) return;
    setFetchingAI(true);
    setAiSuggestions(null);
    try {
      const res = await api.ai.cvFeedback({
        name: result.name,
        email: result.email,
        phone: result.phone,
        skills: result.skills,
        education: result.education,
        experience_years: result.experience_years,
        title: result.headline?.split(' ').slice(0, 5).join(' ') || '',
      });
      if (res.suggestions?.length) {
        setAiSuggestions(res.suggestions);
        toast.success('AI suggestions ready!');
      } else {
        toast.error('AI unavailable right now');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to get AI suggestions');
    } finally {
      setFetchingAI(false);
    }
  };

  return (
    <>
      <SEO title="CV Review" description="Upload your CV and get instant feedback with our AI-powered CV reviewer." />
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="default" size="sm" asChild className="mb-6">
              <Link to="/" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to home
              </Link>
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">CV Review</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">Upload your CV (PDF) and we'll analyze it for skills, education, and experience.</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              {/* Upload area */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => document.getElementById('cv-file-input').click()}>
                <input id="cv-file-input" type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
                {analyzing ? (
                  <div className="py-4">
                    <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
                    <p className="text-sm text-gray-500">Analyzing your CV...</p>
                  </div>
                ) : result ? (
                  <div className="py-4">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                    <p className="text-sm font-medium text-gray-700">CV Analyzed Successfully!</p>
                    <p className="text-xs text-gray-400 mt-1">{file?.name}</p>
                    <button onClick={() => { setFile(null); setResult(null); setAiSuggestions(null); document.getElementById('cv-file-input').value = ''; }} className="text-xs text-primary hover:underline mt-2">Analyze another CV</button>
                  </div>
                ) : (
                  <div className="py-4">
                    <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">Upload your CV</p>
                    <p className="text-xs text-gray-400 mt-1">PDF format, max 10MB</p>
                  </div>
                )}
              </div>

              {/* Results */}
              {result && (
                <div className="mt-6 space-y-6">
                  {/* AI Suggestions Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleAIFeedback}
                      disabled={fetchingAI}
                      className="px-4 py-2 btn-fill text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${fetchingAI ? 'animate-spin' : ''}`} />
                      {fetchingAI ? 'Getting AI feedback...' : 'Get AI Suggestions'}
                    </button>
                  </div>

                  {/* AI Suggestions */}
                  {aiSuggestions && aiSuggestions.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-purple-700 mb-3">
                        <Lightbulb className="w-4 h-4" /> AI Improvement Suggestions
                      </h3>
                      <ul className="space-y-2">
                        {aiSuggestions.map((s, i) => (
                          <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Extracted Info */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-bold text-sm mb-3">Extracted Info</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {result.name && <div><span className="text-xs text-gray-500">Name</span><p className="font-medium">{result.name}</p></div>}
                      {result.email && <div><span className="text-xs text-gray-500">Email</span><p className="font-medium">{result.email}</p></div>}
                      {result.phone && <div><span className="text-xs text-gray-500">Phone</span><p className="font-medium">{result.phone}</p></div>}
                      {result.experience_years > 0 && <div><span className="text-xs text-gray-500">Experience</span><p className="font-medium">{result.experience_years} years</p></div>}
                      {result.education_level && <div><span className="text-xs text-gray-500">Education Level</span><p className="font-medium capitalize">{result.education_level.replace('_', ' ')}</p></div>}
                    </div>
                  </div>

                  {/* Skills */}
                  {result.skills?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" /> Detected Skills ({result.skills.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.skills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {result.education?.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" /> Education
                      </h3>
                      <ul className="space-y-2">
                        {result.education.map((edu, i) => (
                          <li key={i} className="text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2">{edu}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Score */}
                  {result.skills?.length > 0 && (
                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-sm">CV Completeness</h3>
                          <p className="text-xs text-gray-500">Based on detected information</p>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {Math.min(100, (result.name ? 15 : 0) + (result.email ? 15 : 0) + (result.phone ? 10 : 0) + Math.min(30, (result.skills?.length || 0) * 5) + (result.education?.length > 0 ? 20 : 0) + (result.experience_years > 0 ? 10 : 0))}%
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (result.name ? 15 : 0) + (result.email ? 15 : 0) + (result.phone ? 10 : 0) + Math.min(30, (result.skills?.length || 0) * 5) + (result.education?.length > 0 ? 20 : 0) + (result.experience_years > 0 ? 10 : 0))}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <Button variant="default" size="sm" asChild>
                      <Link to="/cv-builder" className="gap-2">Create a new CV with our CV Builder</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
