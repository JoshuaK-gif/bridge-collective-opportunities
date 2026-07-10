import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Download, Eye, ChevronRight, ChevronLeft, FileText, Sparkles, Lightbulb, GripVertical, MoveUp, MoveDown, FileDown, Image, FileType, Linkedin, Github, Globe, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import CVPreview from '@/components/CVPreview';
import { loadCV, saveCV, clearCV, newId } from '@/lib/cvStore';
import { api } from '@/api/client';

const SECTION_LABELS = {
  summary: 'Professional Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  certifications: 'Certifications',
  projects: 'Projects',
  references: 'References',
};

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const LANG_LEVELS = ['Basic', 'Conversational', 'Professional', 'Native'];

const LEVEL_COLORS = {
  Beginner: 'bg-green-100 text-green-700',
  Intermediate: 'bg-blue-100 text-blue-700',
  Advanced: 'bg-purple-100 text-purple-700',
  Expert: 'bg-orange-100 text-orange-700',
  Basic: 'bg-green-100 text-green-700',
  Conversational: 'bg-blue-100 text-blue-700',
  Professional: 'bg-purple-100 text-purple-700',
  Native: 'bg-orange-100 text-orange-700',
};

const STEPS = ['Personal Info', 'Education', 'Experience', 'Skills', 'More', 'Arrange', 'Preview'];

const TEMPLATES = [
  { id: 'modern', name: 'Modern', desc: 'Clean blue gradient', color: 'from-blue-600 to-indigo-600', popular: true },
  { id: 'classic', name: 'Classic', desc: 'Serif traditional', color: 'from-gray-700 to-gray-800' },
  { id: 'elegant', name: 'Elegant', desc: 'Green accent serif', color: 'from-emerald-600 to-emerald-700' },
  { id: 'minimal', name: 'Minimal', desc: 'Clean white, light touch', color: 'from-gray-400 to-gray-500' },
  { id: 'bold', name: 'Bold', desc: 'Dark navy, red accent', color: 'from-[#1a1a2e] to-[#16213e]' },
  { id: 'creative', name: 'Creative', desc: 'Teal sidebar layout', color: 'from-teal-500 to-cyan-600' },
  { id: 'executive', name: 'Executive', desc: 'Navy & gold premium', color: 'from-[#0f1b2d] to-[#1a2a4a]' },
  { id: 'vibrant', name: 'Vibrant', desc: 'Purple-pink gradient', color: 'from-purple-500 via-pink-500 to-orange-400' },
  { id: 'sidebar', name: 'Sidebar', desc: 'Dark sidebar layout', color: 'from-[#2d3436] to-[#1a1a2e]' },
  { id: 'compact', name: 'Compact', desc: 'Dense info layout', color: 'from-gray-600 to-gray-700' },
  { id: 'simple', name: 'Simple', desc: 'Ultra minimal, light', color: 'from-gray-300 to-gray-400' },
  { id: 'professional', name: 'Professional', desc: 'Burgundy serif', color: 'from-[#800020] to-[#a00030]' },
  { id: 'ocean', name: 'Ocean', desc: 'Blue sidebar layout', color: 'from-blue-800 to-cyan-700' },
  { id: 'sunset', name: 'Sunset', desc: 'Orange-red gradient', color: 'from-orange-500 via-red-500 to-pink-500' },
];

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
            i === current ? 'bg-primary text-white' : i < current ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
          }`}>
            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold ${
              i === current ? 'bg-white/20' : i < current ? 'bg-primary/20' : 'bg-gray-200'
            }`}>{i + 1}</span>
            {step}
          </div>
          {i < steps.length - 1 && <div className={`w-3 sm:w-6 h-0.5 ${i < current ? 'bg-primary' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Best for sharing & printing' },
  { id: 'png', label: 'PNG', icon: Image, desc: 'High-quality image' },
  { id: 'jpeg', label: 'JPEG', icon: Image, desc: 'Smaller image file' },
  { id: 'txt', label: 'Plain Text', icon: FileType, desc: 'Raw text content' },
];

function generateCvText(cv) {
  const lines = [];
  if (cv.firstName || cv.lastName) lines.push(`${cv.firstName} ${cv.lastName}`.trim());
  if (cv.title) lines.push(cv.title);
  const socialParts = [];
  if (cv.socialLinks?.linkedin) socialParts.push(`LinkedIn: ${cv.socialLinks.linkedin}`);
  if (cv.socialLinks?.github) socialParts.push(`GitHub: ${cv.socialLinks.github}`);
  if (cv.socialLinks?.portfolio) socialParts.push(`Portfolio: ${cv.socialLinks.portfolio}`);
  const contact = [cv.email, cv.phone, cv.location, ...socialParts].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  lines.push('');

  const sectionOrder = cv.sectionOrder || ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'references'];
  for (const key of sectionOrder) {
    switch (key) {
      case 'summary':
        if (cv.summary?.trim()) { lines.push('PROFESSIONAL SUMMARY', cv.summary, ''); }
        break;
      case 'experience': {
        const exps = cv.experience?.filter(e => e.company) || [];
        if (exps.length) {
          lines.push('EXPERIENCE');
          for (const exp of exps) {
            lines.push(`${exp.position} at ${exp.company}`);
            lines.push(`${exp.startDate} \u2013 ${exp.current ? 'Present' : exp.endDate}`);
            if (exp.description) lines.push(exp.description);
            lines.push('');
          }
        }
        break;
      }
      case 'education': {
        const eds = cv.education?.filter(e => e.school) || [];
        if (eds.length) {
          lines.push('EDUCATION');
          for (const edu of eds) {
            lines.push(`${edu.degree} in ${edu.field} \u2013 ${edu.school}, ${edu.startYear}\u2013${edu.endYear}`);
          }
          lines.push('');
        }
        break;
      }
      case 'skills': {
        const skills = cv.skills?.filter(s => s.name) || [];
        if (skills.length) {
          lines.push('SKILLS');
          for (const s of skills) lines.push(`${s.name} [${s.level}]`);
          lines.push('');
        }
        break;
      }
      case 'languages': {
        const langs = cv.languages?.filter(l => l.name) || [];
        if (langs.length) {
          lines.push('LANGUAGES');
          for (const l of langs) lines.push(`${l.name} [${l.level}]`);
          lines.push('');
        }
        break;
      }
      case 'certifications': {
        const certs = cv.certifications?.filter(c => c.name) || [];
        if (certs.length) {
          lines.push('CERTIFICATIONS');
          for (const c of certs) {
            const parts = [c.name];
            if (c.issuer) parts.push(`Issuer: ${c.issuer}`);
            if (c.date) parts.push(c.date);
            lines.push(parts.join(' \u2013 '));
            if (c.description) lines.push(c.description);
          }
          lines.push('');
        }
        break;
      }
      case 'projects': {
        const projs = cv.projects?.filter(p => p.name) || [];
        if (projs.length) {
          lines.push('PROJECTS');
          for (const p of projs) {
            lines.push(p.name);
            if (p.technologies) lines.push(`Technologies: ${p.technologies}`);
            if (p.link) lines.push(`Link: ${p.link}`);
            if (p.description) lines.push(p.description);
          }
          lines.push('');
        }
        break;
      }
      case 'references': {
        const refs = cv.references?.filter(r => r.name) || [];
        if (refs.length) {
          lines.push('REFERENCES');
          for (const ref of refs) {
            lines.push([ref.name, ref.title, ref.company, ref.email, ref.phone].filter(Boolean).join(' \u2013 '));
          }
          lines.push('');
        }
        break;
      }
    }
    const customSec = cv.customSections?.find(s => `custom:${s.id}` === key || s.title === key);
    if (customSec?.title?.trim() && customSec?.content?.trim()) {
      lines.push(customSec.title.toUpperCase(), customSec.content, '');
    }
  }
  return lines.join('\n');
}

export default function CVBuilder() {
  const [step, setStep] = useState(0);
  const [cv, setCv] = useState(loadCV);
  const previewRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [fetchingFeedback, setFetchingFeedback] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [savingCloud, setSavingCloud] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudToken, setCloudToken] = useState(localStorage.getItem('bridge_cv_token') || '');

  useEffect(() => { saveCV(cv); }, [cv]);

  useEffect(() => {
    const token = localStorage.getItem('bridge_cv_token');
    if (token) {
      setLoadingCloud(true);
      api.resumes.load(token).then(res => {
        if (res.data) {
          setCv(res.data);
          toast.success('CV restored from cloud');
        }
      }).catch(() => {}).finally(() => setLoadingCloud(false));
    }
  }, []);

  const handleCloudSave = async () => {
    setSavingCloud(true);
    try {
      const res = await api.resumes.save(cv, cloudToken);
      setCloudToken(res.token);
      localStorage.setItem('bridge_cv_token', res.token);
      toast.success('CV saved to cloud!');
    } catch {
      toast.error('Failed to save to cloud');
    } finally {
      setSavingCloud(false);
    }
  };

  const update = (field, value) => setCv(prev => ({ ...prev, [field]: value }));

  const addArrayItem = (field, empty) => setCv(prev => ({ ...prev, [field]: [...prev[field], typeof empty === 'string' ? empty : { ...empty, id: newId() }] }));
  const removeArrayItem = (field, index) => setCv(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  const updateArrayItem = (field, index, key, value) => setCv(prev => {
    const items = [...prev[field]];
    items[index] = { ...items[index], [key]: value };
    return { ...prev, [field]: items };
  });

  const nextStep = () => { if (step < STEPS.length - 1) setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const prevStep = () => { if (step > 0) setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const captureCanvas = async () => {
    const el = document.getElementById('cv-preview');
    if (!el) throw new Error('Preview not found');
    await document.fonts.ready;
    const { default: html2canvas } = await import('html2canvas');
    el.style.setProperty('-webkit-font-smoothing', 'antialiased');
    el.style.setProperty('font-smooth', 'never');
    el.style.setProperty('text-rendering', 'geometricPrecision');
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (doc) => {
        const clone = doc.getElementById('cv-preview');
        if (clone) {
          clone.style.setProperty('-webkit-font-smoothing', 'antialiased');
          clone.style.setProperty('font-smooth', 'never');
          clone.style.setProperty('text-rendering', 'geometricPrecision');
          clone.querySelectorAll('[class*="text-xs"], [class*="text-[10px]"], [class*="text-[11px]"]').forEach(
            el => el.style.setProperty('font-size', '0.8125rem', 'important')
          );
        }
      },
    });
    el.style.removeProperty('-webkit-font-smoothing');
    el.style.removeProperty('font-smooth');
    el.style.removeProperty('text-rendering');
    return canvas;
  };

  const downloadBlob = (blob, extension) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cv.firstName || 'CV'}_${cv.lastName || 'Bridge'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (canvas) => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentW = pdfW - margin * 2;
    const contentH = pdfH - margin * 2;
    const pageCanvasH = (contentH * canvas.width) / contentW;
    let srcY = 0;

    while (srcY < canvas.height) {
      const remaining = canvas.height - srcY;
      const sliceH = Math.min(pageCanvasH, remaining);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const pageImgData = pageCanvas.toDataURL('image/png');
      if (srcY > 0) pdf.addPage();
      pdf.addImage(pageImgData, 'PNG', margin, margin, contentW, contentH);
      srcY += pageCanvasH;
    }

    pdf.save(`${cv.firstName || 'CV'}_${cv.lastName || 'Bridge'}.pdf`);
  };

  const handleDownloadImage = async (canvas, type) => {
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = type === 'jpeg' ? 'jpg' : 'png';
    const quality = type === 'jpeg' ? 0.92 : undefined;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
    downloadBlob(blob, ext);
  };

  const handleDownloadText = () => {
    const text = generateCvText(cv);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'txt');
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (format === 'txt') {
        handleDownloadText();
        toast.success('CV downloaded!');
        return;
      }

      const canvas = await captureCanvas();

      if (format === 'pdf') {
        await handleDownloadPdf(canvas);
      } else if (format === 'png' || format === 'jpeg') {
        await handleDownloadImage(canvas, format);
      }

      toast.success('CV downloaded!');
    } catch (err) {
      toast.error(`Failed to generate ${format.toUpperCase()}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <SEO title="CV Builder" description="Create a professional CV online with our free CV builder." />
      <div className="min-h-screen bg-[#eef0fa]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">CV Builder</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">Create a professional CV in minutes. Your data is saved locally.</p>

            <StepIndicator current={step} steps={STEPS} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Form */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  {/* Step 0: Personal Info */}
                  {step === 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold mb-4">Personal Information</h2>
                      {/* Photo Upload */}
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          {cv.photo ? (
                            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                              <img src={cv.photo} alt="Profile" className="w-full h-full object-cover" />
                              <button
                                onClick={() => update('photo', '')}
                                className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                title="Remove photo"
                              >×</button>
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => document.getElementById('photo-input').click()}>
                              <span className="text-2xl text-gray-400">+</span>
                            </div>
                          )}
                          <input
                            id="photo-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error('Photo must be under 2MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                update('photo', ev.target?.result || '');
                                toast.success('Photo added!');
                              };
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          <p className="font-medium text-gray-600 mb-0.5">Profile Photo</p>
                          <p>Upload a photo (max 2MB).</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-gray-600">First Name</label><Input value={cv.firstName} onChange={e => update('firstName', e.target.value)} placeholder="John" /></div>
                        <div><label className="text-xs font-medium text-gray-600">Last Name</label><Input value={cv.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Doe" /></div>
                      </div>
                      <div><label className="text-xs font-medium text-gray-600">Professional Title</label><Input value={cv.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Software Developer" /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-gray-600">Email</label><Input type="email" value={cv.email} onChange={e => update('email', e.target.value)} placeholder="john@email.com" /></div>
                        <div><label className="text-xs font-medium text-gray-600">Phone</label><Input value={cv.phone} onChange={e => update('phone', e.target.value)} placeholder="+256 700 000 000" /></div>
                      </div>
                      <div><label className="text-xs font-medium text-gray-600">Location</label><Input value={cv.location} onChange={e => update('location', e.target.value)} placeholder="Kampala, Uganda" /></div>
                      <div className="border-t border-gray-100 pt-4 mt-2">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Social & Portfolio Links</h3>
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Linkedin className="w-4 h-4 text-blue-600 shrink-0" />
                            <Input value={cv.socialLinks?.linkedin || ''} onChange={e => update('socialLinks', { ...cv.socialLinks, linkedin: e.target.value })} placeholder="linkedin.com/in/yourprofile" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Github className="w-4 h-4 text-gray-700 shrink-0" />
                            <Input value={cv.socialLinks?.github || ''} onChange={e => update('socialLinks', { ...cv.socialLinks, github: e.target.value })} placeholder="github.com/yourusername" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                            <Input value={cv.socialLinks?.portfolio || ''} onChange={e => update('socialLinks', { ...cv.socialLinks, portfolio: e.target.value })} placeholder="yourportfolio.com" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Twitter className="w-4 h-4 text-sky-500 shrink-0" />
                            <Input value={cv.socialLinks?.twitter || ''} onChange={e => update('socialLinks', { ...cv.socialLinks, twitter: e.target.value })} placeholder="@yourhandle" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Professional Summary</label>
                        <div className="flex flex-col sm:flex-row gap-2 mt-1">
                          <textarea value={cv.summary} onChange={e => update('summary', e.target.value)} rows={4} className="flex-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Brief overview of your background and goals..." />
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                setGeneratingSummary(true);
                                try {
                                  const result = await api.ai.generateSummary(cv);
                                  if (result.summary) { update('summary', result.summary); toast.success('Summary generated!'); }
                                  else toast.error('AI unavailable');
                                } catch (err) { toast.error(err?.message || 'Failed to generate summary'); }
                                finally { setGeneratingSummary(false); }
                              }}
                              disabled={generatingSummary}
                              className="px-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium hover:opacity-90 transition-opacity shrink-0 flex items-center gap-1.5"
                              title="Generate with AI"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${generatingSummary ? 'animate-spin' : ''}`} />
                              {generatingSummary ? '...' : 'Generate'}
                            </button>
                            <button
                              onClick={async () => {
                                if (!cv.summary?.trim()) { toast.error('Write a summary first'); return; }
                                setGeneratingSummary(true);
                                try {
                                  const result = await api.ai.rewrite(cv.summary, 'summary', 'professional');
                                  if (result.rewritten) { update('summary', result.rewritten); toast.success('Summary polished!'); }
                                  else toast.error('AI unavailable');
                                } catch (err) { toast.error(err?.message || 'Failed to polish'); }
                                finally { setGeneratingSummary(false); }
                              }}
                              disabled={generatingSummary || !cv.summary?.trim()}
                              className="px-3 rounded-lg border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors shrink-0 flex items-center gap-1.5"
                              title="Polish existing text with AI"
                            >
                              <Sparkles className="w-3 h-3" />
                              Polish
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Education — draggable */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold">Education</h2>
                        <Button variant="outline" size="sm" onClick={() => addArrayItem('education', { id: newId(), school: '', degree: '', field: '', startYear: '', endYear: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                      </div>
                      {cv.education.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No education entries. Click "Add" to start.</p>}
                      {cv.education.map((edu, i) => (
                        <div key={edu.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative draggable-item"
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('text/plain', `education:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                          onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                          onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-primary');
                            const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                            if (fromField !== 'education') return;
                            const items = [...cv.education];
                            const [moved] = items.splice(parseInt(fromIdx), 1);
                            items.splice(i, 0, moved);
                            update('education', items);
                          }}
                        >
                          {cv.education.length > 1 && (
                            <button onClick={() => removeArrayItem('education', i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                          <div className="flex items-center gap-1 mb-2">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                            <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">School / Institution</label><Input value={edu.school} onChange={e => updateArrayItem('education', i, 'school', e.target.value)} placeholder="Makerere University" /></div>
                            <div><label className="text-xs font-medium text-gray-600">Degree</label><Input value={edu.degree} onChange={e => updateArrayItem('education', i, 'degree', e.target.value)} placeholder="Bachelor of Science" /></div>
                            <div><label className="text-xs font-medium text-gray-600">Field of Study</label><Input value={edu.field} onChange={e => updateArrayItem('education', i, 'field', e.target.value)} placeholder="Computer Science" /></div>
                            <div><label className="text-xs font-medium text-gray-600">Start Year</label><Input value={edu.startYear} onChange={e => updateArrayItem('education', i, 'startYear', e.target.value)} placeholder="2018" /></div>
                            <div><label className="text-xs font-medium text-gray-600">End Year</label><Input value={edu.endYear} onChange={e => updateArrayItem('education', i, 'endYear', e.target.value)} placeholder="2022" /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 2: Experience — draggable */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold">Work Experience</h2>
                        <Button variant="outline" size="sm" onClick={() => addArrayItem('experience', { id: newId(), company: '', position: '', startDate: '', endDate: '', current: false, description: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                      </div>
                      {cv.experience.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No experience entries. Click "Add" to start.</p>}
                      {cv.experience.map((exp, i) => (
                        <div key={exp.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative draggable-item"
                          draggable
                          onDragStart={e => { e.dataTransfer.setData('text/plain', `experience:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                          onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                          onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-primary');
                            const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                            if (fromField !== 'experience') return;
                            const items = [...cv.experience];
                            const [moved] = items.splice(parseInt(fromIdx), 1);
                            items.splice(i, 0, moved);
                            update('experience', items);
                          }}
                        >
                          {cv.experience.length > 1 && (
                            <button onClick={() => removeArrayItem('experience', i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                          <div className="flex items-center gap-1 mb-2">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                            <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className="text-xs font-medium text-gray-600">Company</label><Input value={exp.company} onChange={e => updateArrayItem('experience', i, 'company', e.target.value)} placeholder="Google" /></div>
                            <div><label className="text-xs font-medium text-gray-600">Position</label><Input value={exp.position} onChange={e => updateArrayItem('experience', i, 'position', e.target.value)} placeholder="Software Engineer" /></div>
                            <div><label className="text-xs font-medium text-gray-600">Start Date</label><Input value={exp.startDate} onChange={e => updateArrayItem('experience', i, 'startDate', e.target.value)} placeholder="Jan 2020" /></div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1"><label className="text-xs font-medium text-gray-600">End Date</label><Input value={exp.endDate} onChange={e => updateArrayItem('experience', i, 'endDate', e.target.value)} placeholder="Present" disabled={exp.current} /></div>
                              <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-500 cursor-pointer shrink-0">
                                <input type="checkbox" checked={exp.current} onChange={e => updateArrayItem('experience', i, 'current', e.target.checked)} className="rounded" />
                                Current
                              </label>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs font-medium text-gray-600">Description</label>
                              <textarea value={exp.description} onChange={e => updateArrayItem('experience', i, 'description', e.target.value)} rows={3} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Key responsibilities and achievements..." />
                              {exp.description?.trim() && (
                                <button
                                  onClick={async () => {
                                    setGeneratingSummary(true);
                                    try {
                                      const result = await api.ai.rewrite(exp.description, 'description', 'professional');
                                      if (result.rewritten) { updateArrayItem('experience', i, 'description', result.rewritten); toast.success('Description polished!'); }
                                      else toast.error('AI unavailable');
                                    } catch { toast.error('Failed to polish'); }
                                    finally { setGeneratingSummary(false); }
                                  }}
                                  disabled={generatingSummary}
                                  className="mt-1.5 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-600 text-[10px] font-medium hover:bg-purple-50 transition-colors flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" /> Polish with AI
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Skills & Languages */}
                  {step === 3 && (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">Skills</h2>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!cv.title) { toast.error('Add a professional title first'); return; }
                                setSuggestingSkills(true);
                                try {
                                  const skillNames = cv.skills.map(s => s.name).filter(Boolean);
                                  const result = await api.ai.suggestSkills(cv.title, skillNames);
                                  if (result.skills?.length) {
                                    const existing = skillNames.map(s => s.toLowerCase());
                                    const newSkills = result.skills.filter(s => !existing.includes(s.toLowerCase()));
                                    const combined = [...cv.skills, ...newSkills.map(s => ({ id: newId(), name: s, level: 'Intermediate' }))];
                                    update('skills', combined);
                                    toast.success(`${newSkills.length} skills suggested!`);
                                  } else toast.error('AI unavailable');
                                 } catch (err) { toast.error(err?.message || 'Failed to get suggestions'); }
                                 finally { setSuggestingSkills(false); }
                              }}
                              disabled={suggestingSkills}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${suggestingSkills ? 'animate-spin' : ''}`} />
                              {suggestingSkills ? '...' : 'AI Suggest'}
                            </button>
                            <Button variant="outline" size="sm" onClick={() => update('skills', [...cv.skills, { id: newId(), name: '', level: 'Intermediate' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {cv.skills.map((skill, i) => (
                            <div key={skill.id || i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 draggable-item flex-wrap sm:flex-nowrap"
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('text/plain', `skills:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                              onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                              onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary');
                                const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                                if (fromField !== 'skills') return;
                                const items = [...cv.skills];
                                const [moved] = items.splice(parseInt(fromIdx), 1);
                                items.splice(i, 0, moved);
                                update('skills', items);
                              }}
                            >
                              <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                              <input value={skill.name} onChange={e => { const s = [...cv.skills]; s[i] = { ...s[i], name: e.target.value }; update('skills', s); }} className="flex-1 text-sm text-gray-900 bg-transparent border-none outline-none min-w-[80px]" placeholder="e.g. JavaScript" />
                              <select
                                value={skill.level}
                                onChange={e => { const s = [...cv.skills]; s[i] = { ...s[i], level: e.target.value }; update('skills', s); }}
                                className={`text-xs rounded-md border border-gray-200 px-1.5 py-0.5 bg-white font-medium ${LEVEL_COLORS[skill.level] || LEVEL_COLORS.Intermediate}`}
                              >
                                {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              <button onClick={() => { const s = cv.skills.filter((_, j) => j !== i); update('skills', s); }} className="text-gray-400 hover:text-red-500 p-0.5 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">Languages</h2>
                          <Button variant="outline" size="sm" onClick={() => update('languages', [...cv.languages, { id: newId(), name: '', level: 'Professional' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        <div className="space-y-2">
                          {cv.languages.map((lang, i) => (
                            <div key={lang.id || i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 draggable-item flex-wrap sm:flex-nowrap"
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('text/plain', `languages:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                              onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                              onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary');
                                const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                                if (fromField !== 'languages') return;
                                const items = [...cv.languages];
                                const [moved] = items.splice(parseInt(fromIdx), 1);
                                items.splice(i, 0, moved);
                                update('languages', items);
                              }}
                            >
                              <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                              <input value={lang.name} onChange={e => { const l = [...cv.languages]; l[i] = { ...l[i], name: e.target.value }; update('languages', l); }} className="flex-1 text-sm text-gray-900 bg-transparent border-none outline-none min-w-[80px]" placeholder="e.g. English" />
                              <select
                                value={lang.level}
                                onChange={e => { const l = [...cv.languages]; l[i] = { ...l[i], level: e.target.value }; update('languages', l); }}
                                className={`text-xs rounded-md border border-gray-200 px-1.5 py-0.5 bg-white font-medium ${LEVEL_COLORS[lang.level] || LEVEL_COLORS.Professional}`}
                              >
                                {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              <button onClick={() => { const l = cv.languages.filter((_, j) => j !== i); update('languages', l); }} className="text-gray-400 hover:text-red-500 p-0.5 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">Template</h2>
                          <span className="text-[10px] text-gray-400">{TEMPLATES.length} styles</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {TEMPLATES.map(t => (
                            <button
                              key={t.id}
                              onClick={() => update('template', t.id)}
                              className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                                cv.template === t.id
                                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className={`h-8 rounded-lg ${t.color} mb-2 flex items-center justify-center ${cv.template === t.id ? 'ring-2 ring-white/50' : ''}`}>
                                {t.popular && (
                                  <span className="text-[8px] font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">POPULAR</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-semibold">{t.name}</p>
                                {t.id === 'sidebar' || t.id === 'creative' || t.id === 'ocean' ? (
                                  <span className="text-[8px] text-purple-500 font-medium bg-purple-50 px-1 rounded">2-col</span>
                                ) : null}
                              </div>
                              <p className="text-[9px] text-gray-400 mt-0.5">{t.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: More Sections (Certifications, Projects, References, Custom) */}
                  {step === 4 && (
                    <div className="space-y-6">
                      {/* Certifications */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">Certifications</h2>
                          <Button variant="outline" size="sm" onClick={() => update('certifications', [...cv.certifications, { id: newId(), name: '', issuer: '', date: '', link: '', description: '' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        {cv.certifications.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No certifications yet.</p>}
                        {cv.certifications.map((cert, i) => (
                          <div key={cert.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3 draggable-item"
                            draggable
                            onDragStart={e => { e.dataTransfer.setData('text/plain', `certifications:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                            onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                            onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                            onDrop={e => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-primary');
                              const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                              if (fromField !== 'certifications') return;
                              const items = [...cv.certifications];
                              const [moved] = items.splice(parseInt(fromIdx), 1);
                              items.splice(i, 0, moved);
                              update('certifications', items);
                            }}
                          >
                            {cv.certifications.length > 1 && (
                              <button onClick={() => update('certifications', cv.certifications.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                            <div className="flex items-center gap-1 mb-2">
                              <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                              <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Certification Name</label><Input value={cert.name} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], name: e.target.value }; update('certifications', c); }} placeholder="e.g. Google Data Analytics" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Issuer</label><Input value={cert.issuer} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], issuer: e.target.value }; update('certifications', c); }} placeholder="Coursera / Google" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Date</label><Input value={cert.date} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], date: e.target.value }; update('certifications', c); }} placeholder="2024" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Credential URL (optional)</label><Input value={cert.link} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], link: e.target.value }; update('certifications', c); }} placeholder="https://coursera.org/verify/..." /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Description (optional)</label>
                                <textarea value={cert.description} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], description: e.target.value }; update('certifications', c); }} rows={2} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Key skills covered..." />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Projects */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">Projects</h2>
                          <Button variant="outline" size="sm" onClick={() => update('projects', [...cv.projects, { id: newId(), name: '', description: '', technologies: '', link: '' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        {cv.projects.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Add projects to showcase your work.</p>}
                        {cv.projects.map((proj, i) => (
                          <div key={proj.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3 draggable-item"
                            draggable
                            onDragStart={e => { e.dataTransfer.setData('text/plain', `projects:${i}`); e.currentTarget.classList.add('opacity-40'); }}
                            onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                            onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                            onDrop={e => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-primary');
                              const [fromField, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                              if (fromField !== 'projects') return;
                              const items = [...cv.projects];
                              const [moved] = items.splice(parseInt(fromIdx), 1);
                              items.splice(i, 0, moved);
                              update('projects', items);
                            }}
                          >
                            {cv.projects.length > 1 && (
                              <button onClick={() => update('projects', cv.projects.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                            <div className="flex items-center gap-1 mb-2">
                              <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                              <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Project Name</label><Input value={proj.name} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], name: e.target.value }; update('projects', p); }} placeholder="e.g. Bridge Jobs Platform" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Technologies Used</label><Input value={proj.technologies} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], technologies: e.target.value }; update('projects', p); }} placeholder="React, Node.js, PostgreSQL" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Project URL (optional)</label><Input value={proj.link} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], link: e.target.value }; update('projects', p); }} placeholder="https://github.com/..." /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Description</label>
                                <textarea value={proj.description} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], description: e.target.value }; update('projects', p); }} rows={2} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="What did you build? What problem does it solve?" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* References */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold">References</h2>
                          <Button variant="outline" size="sm" onClick={() => addArrayItem('references', { id: newId(), name: '', title: '', company: '', email: '', phone: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        {cv.references.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No references added.</p>}
                        {cv.references.map((ref, i) => (
                          <div key={ref.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                            {cv.references.length > 1 && (
                              <button onClick={() => removeArrayItem('references', i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><label className="text-xs font-medium text-gray-600">Full Name</label><Input value={ref.name} onChange={e => updateArrayItem('references', i, 'name', e.target.value)} placeholder="Jane Smith" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Job Title</label><Input value={ref.title} onChange={e => updateArrayItem('references', i, 'title', e.target.value)} placeholder="Senior Manager" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Company</label><Input value={ref.company} onChange={e => updateArrayItem('references', i, 'company', e.target.value)} placeholder="Organization Name" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Email</label><Input type="email" value={ref.email} onChange={e => updateArrayItem('references', i, 'email', e.target.value)} placeholder="jane@email.com" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Phone</label><Input value={ref.phone} onChange={e => updateArrayItem('references', i, 'phone', e.target.value)} placeholder="+256 700 000 000" /></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Custom Sections */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h2 className="text-lg font-bold">Custom Sections</h2>
                            <p className="text-xs text-gray-400">Add extra sections like Signature, Awards, or anything else</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => addArrayItem('customSections', { id: newId(), title: '', content: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add Section</Button>
                        </div>
                        {cv.customSections.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No custom sections.</p>}
                        {cv.customSections.map((sec, i) => (
                          <div key={sec.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                            <button onClick={() => { const s = cv.customSections.filter((_, j) => j !== i); update('customSections', s); }} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-gray-600">Section Title</label>
                                <Input value={sec.title} onChange={e => { const s = [...cv.customSections]; s[i] = { ...s[i], title: e.target.value }; update('customSections', s); }} placeholder="e.g. Awards, Signature" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-600">Content</label>
                                <textarea value={sec.content} onChange={e => { const s = [...cv.customSections]; s[i] = { ...s[i], content: e.target.value }; update('customSections', s); }} rows={3} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Enter your content here..." />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Arrange Sections — Canva-style drag & drop */}
                  {step === 5 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-lg font-bold">Arrange Sections</h2>
                          <p className="text-xs text-gray-400 mt-1">Drag sections up/down to arrange your CV layout</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {cv.sectionOrder.map((sectionKey, index) => {
                          const label = SECTION_LABELS[sectionKey] || (
                            cv.customSections.find(s => s.title === sectionKey || `custom:${s.id}` === sectionKey)?.title || sectionKey
                          );
                          const isVisible = sectionKey === 'summary' ? !!cv.summary?.trim() :
                            sectionKey === 'experience' ? cv.experience?.filter(e => e.company).length > 0 :
                            sectionKey === 'education' ? cv.education?.filter(e => e.school).length > 0 :
                            sectionKey === 'skills' ? cv.skills?.filter(s => s.name).length > 0 :
                            sectionKey === 'languages' ? cv.languages?.filter(l => l.name).length > 0 :
                            sectionKey === 'certifications' ? cv.certifications?.filter(c => c.name).length > 0 :
                            sectionKey === 'projects' ? cv.projects?.filter(p => p.name).length > 0 :
                            sectionKey === 'references' ? cv.references?.filter(r => r.name).length > 0 :
                            true;
                          const sectionIcons = {
                            summary: '📋', experience: '💼', education: '🎓', skills: '⚡',
                            languages: '🌍', certifications: '📜', projects: '🚀', references: '👤',
                          };
                          return (
                            <div
                              key={sectionKey}
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('text/plain', `section:${index}`); e.currentTarget.classList.add('opacity-40'); }}
                              onDragEnd={e => e.currentTarget.classList.remove('opacity-40')}
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'ring-2', 'ring-primary/20'); }}
                              onDragLeave={e => e.currentTarget.classList.remove('border-primary', 'ring-2', 'ring-primary/20')}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary', 'ring-2', 'ring-primary/20');
                                const [type, fromIdx] = e.dataTransfer.getData('text/plain').split(':');
                                if (type !== 'section') return;
                                const order = [...cv.sectionOrder];
                                const [moved] = order.splice(parseInt(fromIdx), 1);
                                order.splice(index, 0, moved);
                                update('sectionOrder', order);
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all ${
                                isVisible
                                  ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                  : 'bg-gray-50 border-gray-100 opacity-50'
                              }`}
                            >
                              <GripVertical className="w-5 h-5 text-gray-300 shrink-0" />
                              <span className="text-sm shrink-0">{sectionIcons[sectionKey] || '📄'}</span>
                              <div className="flex-1 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
                                <span className="text-sm font-medium text-gray-900">{label}</span>
                                {!isVisible && <span className="text-[10px] text-gray-400">(empty)</span>}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    if (index === 0) return;
                                    const order = [...cv.sectionOrder];
                                    [order[index - 1], order[index]] = [order[index], order[index - 1]];
                                    update('sectionOrder', order);
                                  }}
                                  disabled={index === 0}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                  title="Move up"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (index === cv.sectionOrder.length - 1) return;
                                    const order = [...cv.sectionOrder];
                                    [order[index], order[index + 1]] = [order[index + 1], order[index]];
                                    update('sectionOrder', order);
                                  }}
                                  disabled={index === cv.sectionOrder.length - 1}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                  title="Move down"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {cv.customSections.length > 0 && (
                        <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                          <p className="text-xs text-purple-700">
                            <strong>Custom sections</strong> appear at the end. Drag them above to reorder.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 6: Preview */}
                  {step === 6 && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <h2 className="text-lg font-bold">Preview & Download</h2>
                        <div className="flex flex-wrap items-center gap-2">
                          {aiFeedback && (
                            <Button variant="outline" size="sm" onClick={() => setAiFeedback(null)} className="text-xs">
                              Hide AI Feedback
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setFetchingFeedback(true);
                              try {
                                const result = await api.ai.cvFeedback(cv);
                                setAiFeedback(result.suggestions || []);
                                if (!result.suggestions?.length) toast.error('AI unavailable');
                              } catch (err) { toast.error(err?.message || 'Failed to get feedback'); }
                              finally { setFetchingFeedback(false); }
                            }}
                            disabled={fetchingFeedback}
                            className="gap-1 text-xs"
                          >
                            <Lightbulb className={`w-3.5 h-3.5 ${fetchingFeedback ? 'animate-pulse' : ''}`} />
                            {fetchingFeedback ? 'Analyzing...' : 'AI Review'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { clearCV(); setCv(loadCV()); toast.success('CV cleared'); }} className="text-red-500 hover:text-red-600 text-xs">Clear</Button>
                          <div className="flex gap-1">
                            <div className="relative">
                              <select
                                value={format}
                                onChange={e => setFormat(e.target.value)}
                                className="h-8 text-xs rounded-lg border border-gray-200 px-2 bg-white text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                {FORMATS.map(f => (
                                  <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                              </select>
                            </div>
                            <Button size="sm" onClick={handleDownload} disabled={downloading} className="gap-1">
                              <Download className="w-3.5 h-3.5" /> {downloading ? 'Generating...' : 'Download'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {aiFeedback && aiFeedback.length > 0 && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                          <h3 className="text-sm font-bold flex items-center gap-2 text-purple-700 mb-3">
                            <Sparkles className="w-4 h-4" /> AI Suggestions
                          </h3>
                          <ul className="space-y-2">
                            {aiFeedback.map((s, i) => (
                              <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!cv.firstName && !cv.email && !cv.phone ? (
                        <div className="text-center py-12 text-gray-400">
                          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Your CV preview will appear here. Fill in your details in the previous steps.</p>
                        </div>
                      ) : (
                        <div ref={previewRef}>
                          <CVPreview data={cv} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-100">
                    <Button variant="outline" onClick={prevStep} disabled={step === 0} className="gap-1 w-full sm:w-auto justify-center">
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <Button variant="outline" size="sm" onClick={handleCloudSave} disabled={savingCloud} className="gap-1 text-xs flex-1 sm:flex-initial">
                        {savingCloud ? 'Saving...' : 'Save to Cloud'}
                      </Button>
                      {cloudToken && (
                        <span className="text-[10px] text-muted-foreground self-center">Saved</span>
                      )}
                      {step < STEPS.length - 1 ? (
                        <Button onClick={nextStep} className="gap-1 flex-1 sm:flex-initial justify-center">
                          Next <ChevronRight className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button onClick={() => setStep(0)} variant="outline" className="gap-1 flex-1 sm:flex-initial justify-center">
                          <FileText className="w-4 h-4" /> Start Over
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar preview */}
              <div className="lg:col-span-2 hidden lg:block">
                <div className="sticky top-24">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Live Preview
                    </h3>
                    <div style={{ transform: 'scale(0.65)', transformOrigin: 'top left', width: '153.8%' }}>
                      <CVPreview data={cv} compact />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
