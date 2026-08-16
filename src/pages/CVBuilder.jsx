import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { ArrowLeft, Plus, Trash2, Download, Eye, EyeOff, Undo2, ChevronRight, ChevronLeft, FileText, GripVertical, MoveUp, MoveDown, Image as ImageIcon, FileType, Linkedin, Github, Globe, Twitter, ZoomIn, ZoomOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import CVPreview from '@/components/CVPreview';
import { loadCV, saveCV, clearCV, newId } from '@/lib/cvStore';

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

const STEPS = ['Personal Info', 'Education', 'Experience', 'Skills', 'Style', 'More', 'Arrange', 'Preview'];

// Phase 2.3: ATS-safe templates are clearly labeled. Multi-column templates show ATS warning.
const TEMPLATES = [
  { id: 'modern', name: 'Modern', desc: 'Clean blue gradient', color: 'from-blue-600 to-indigo-600', popular: true },
  { id: 'classic', name: 'Classic', desc: 'Serif traditional', color: 'from-gray-700 to-gray-800' },
  { id: 'elegant', name: 'Elegant', desc: 'Green accent serif', color: 'from-emerald-600 to-emerald-700' },
  { id: 'minimal', name: 'Minimal', desc: 'Clean white, light touch', color: 'from-gray-400 to-gray-500', atsSafe: true },
  { id: 'bold', name: 'Bold', desc: 'Dark navy, red accent', color: 'from-[#1a1a2e] to-[#16213e]' },
  { id: 'creative', name: 'Creative', desc: 'Teal sidebar layout', color: 'from-teal-500 to-cyan-600', multiColumn: true },
  { id: 'executive', name: 'Executive', desc: 'Navy & gold premium', color: 'from-[#0f1b2d] to-[#1a2a4a]' },
  { id: 'vibrant', name: 'Vibrant', desc: 'Purple-pink gradient', color: 'from-purple-500 via-pink-500 to-orange-400' },
  { id: 'sidebar', name: 'Sidebar', desc: 'Dark sidebar layout', color: 'from-[#2d3436] to-[#1a1a2e]', multiColumn: true },
  { id: 'compact', name: 'Compact', desc: 'Dense info layout', color: 'from-gray-600 to-gray-700', atsSafe: true },
  { id: 'simple', name: 'Simple', desc: 'Ultra minimal, light', color: 'from-gray-300 to-gray-400', atsSafe: true },
  { id: 'professional', name: 'Professional', desc: 'Burgundy serif', color: 'from-[#800020] to-[#a00030]' },
  { id: 'ocean', name: 'Ocean', desc: 'Blue sidebar layout', color: 'from-blue-800 to-cyan-700', multiColumn: true },
  { id: 'sunset', name: 'Sunset', desc: 'Orange-red gradient', color: 'from-orange-500 via-red-500 to-pink-500' },
];

// Phase 1.1: @dnd-kit SortableItem wrapper — works on mobile via TouchSensor
function SortableItem({ id, children, className = '' }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className={className}>
      <span {...attributes} {...listeners} className="inline-flex mr-1.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      {children}
    </div>
  );
}

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
  { id: 'docx', label: 'Word', icon: FileText, desc: 'Microsoft Word format' },
  { id: 'png', label: 'PNG', icon: ImageIcon, desc: 'High-quality image' },
  { id: 'jpeg', label: 'JPEG', icon: ImageIcon, desc: 'Smaller image file' },
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
  const [format, setFormat] = useState('pdf');

  // Phase 1.2: Mobile preview modal
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  // Phase 1.4: Mobile bottom sheet for skill/language level
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetField, setBottomSheetField] = useState(null); // { type, index }
  const [bottomSheetOptions, setBottomSheetOptions] = useState([]);
  // Phase 3.5: Undo stack (last 10 CV snapshots)
  const [undoStack, setUndoStack] = useState([]);
  const pushUndo = (cvSnap) => setUndoStack(prev => [cvSnap, ...prev].slice(0, 10));
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    setCv(previous);
    setUndoStack(rest);
    toast.success('Undone last change');
  };

  // Phase 3.4: Hidden sections set (section keys that are hidden in preview)
  const [hiddenSections, setHiddenSections] = useState([]);
  const toggleSectionVisibility = (sectionKey) => {
    setHiddenSections(prev =>
      prev.includes(sectionKey) ? prev.filter(s => s !== sectionKey) : [...prev, sectionKey]
    );
  };

  // Photo crop modal state (react-easy-crop)
  const [cropImage, setCropImage] = useState(null); // blob URL of image to crop
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropUploading, setCropUploading] = useState(false);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Crop the image on a canvas, then upload the cropped blob to Cloudinary
  const handleCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels) return;
    setCropUploading(true);
    try {
      const image = new Image();
      image.src = cropImage;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const { x, y, width, height } = croppedAreaPixels;
      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);
      // Draw circular clip for profile photo
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, x, y, width, height, 0, 0, outputSize, outputSize);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Failed to create image');

      // Upload cropped image to Cloudinary (direct browser upload)
      const data = await api.upload.cvPhoto(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      update('photo', data.url);
      toast.success('Photo cropped & uploaded!');
    } catch (err) {
      toast.error(err?.message || 'Failed to crop photo. Try again.');
    } finally {
      if (cropImage) URL.revokeObjectURL(cropImage);
      setCropUploading(false);
      setCropImage(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
    }
  };

  // Phase 3.3: Auto-resize textarea on input
  const autoResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
  };

  // Wrap update functions to push undo before changes
  const updateWithUndo = (field, value) => {
    pushUndo(cv);
    update(field, value);
  };
  const updateArrayItemWithUndo = (field, index, key, value) => {
    pushUndo(cv);
    updateArrayItem(field, index, key, value);
  };

  // Phase 1.1: @dnd-kit sensors (touch + mouse + keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { saveCV(cv); }, [cv]);


  const update = (field, value) => {
    pushUndo(cv);
    setCv(prev => ({ ...prev, [field]: value }));
  };

  const addArrayItem = (field, empty) => {
    pushUndo(cv);
    setCv(prev => ({ ...prev, [field]: [...prev[field], typeof empty === 'string' ? empty : { ...empty, id: newId() }] }));
  };
  const removeArrayItem = (field, index) => {
    pushUndo(cv);
    setCv(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };
  const updateArrayItem = (field, index, key, value) => {
    pushUndo(cv);
    setCv(prev => {
      const items = [...prev[field]];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, [field]: items };
    });
  };

  const nextStep = () => { if (step < STEPS.length - 1) setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const prevStep = () => { if (step > 0) setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const captureCanvas = async () => {
    const el = document.getElementById('cv-preview');
    if (!el) throw new Error('Preview not found');
    // Wait for all fonts to be fully loaded before capture
    await document.fonts.ready;
    // Wait for next paint frame so fonts are fully rasterized
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (doc) => {
        // Lock exact dimensions on the clone to prevent layout reflow
        const clone = doc.getElementById('cv-preview');
        if (clone) {
          clone.style.width = `${el.offsetWidth}px`;
          clone.style.height = `${el.offsetHeight}px`;
        }
      },
    });
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

  // Phase 4.1: DOCX export via simple HTML-based Blob
  const handleDownloadDocx = () => {
    const text = generateCvText(cv);
    // Wrap plain text in a minimal Word-compatible HTML document
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${cv.firstName || 'CV'} ${cv.lastName || ''}</title></head><body>
      <h1>${cv.firstName || ''} ${cv.lastName || ''}</h1>
      ${cv.title ? `<h2>${cv.title}</h2>` : ''}
      <pre style="font-family:'Calibri',sans-serif;font-size:11pt;white-space:pre-wrap;word-wrap:break-word;">${text.replace(/>/g,'&gt;').replace(/</g,'&lt;')}</pre>
    </body></html>`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    downloadBlob(blob, 'doc');
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (format === 'txt') {
        handleDownloadText();
        toast.success('CV downloaded!');
        return;
      }

      if (format === 'docx') {
        handleDownloadDocx();
        toast.success('CV downloaded!');
        return;
      }

      if (format === 'pdf') {
        const canvas = await captureCanvas();
        await handleDownloadPdf(canvas);
        toast.success('CV downloaded!');
        return;
      }

      const canvas = await captureCanvas();

      if (format === 'png' || format === 'jpeg') {
        await handleDownloadImage(canvas, format);
      }

      toast.success('CV downloaded!');
    } catch {
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
            <Button variant="default" size="sm" asChild className="mb-4">
              <Link to="/" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to home
              </Link>
            </Button>

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
                      <h2 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h2>
                      {/* Photo Upload */}
                      <div className="flex items-center gap-4">
                        {/* Phase 1.5+1.9: Smaller photo on mobile, camera capture */}
                        <div className="relative shrink-0">
                          {cv.photo ? (
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-gray-200">
                              <img src={cv.photo} alt="Profile" className="w-full h-full object-cover" />
                              <button
                                onClick={() => update('photo', '')}
                                className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                title="Remove photo"
                              >×</button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => document.getElementById('photo-input').click()}>
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
                              // Show crop modal instead of uploading directly
                              const blobUrl = URL.createObjectURL(file);
                              setCropImage(blobUrl);
                              setCrop({ x: 0, y: 0 });
                              setZoom(1);
                              e.target.value = '';
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          <p className="font-medium text-gray-600 mb-0.5">Profile Photo</p>
                          <p>Upload a photo (max 2MB).</p>
                        </div>
                      </div>

                      {/* Photo crop modal */}
                      {cropImage && (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={() => { URL.revokeObjectURL(cropImage); setCropImage(null); }}>
                          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                              <h3 className="text-sm font-bold text-gray-900">Crop Photo</h3>
                              <button onClick={() => { URL.revokeObjectURL(cropImage); setCropImage(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg">×</button>
                            </div>
                            {/* Cropper */}
                            <div className="relative w-full h-64 sm:h-80 bg-gray-900">
                              <Cropper
                                image={cropImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                              />
                            </div>
                            {/* Zoom Slider */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                              <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
                              <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={e => setZoom(Number(e.target.value))}
                                className="flex-1 h-1.5 accent-primary cursor-pointer"
                              />
                              <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
                            </div>
                            {/* Actions */}
                            <div className="flex gap-3 px-4 py-3">
                              <button
                                onClick={() => { URL.revokeObjectURL(cropImage); setCropImage(null); }}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleCropConfirm}
                                disabled={cropUploading}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {cropUploading ? (
                                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cropping...</>
                                ) : (
                                  'Apply & Upload'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
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
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-medium text-gray-600">Professional Summary</label>
                          <button onClick={() => toggleSectionVisibility('summary')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('summary') ? 'Show in CV' : 'Hide from CV'}>
                            {hiddenSections.includes('summary') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="flex-1">
                            <textarea
                              value={cv.summary}
                              onChange={e => update('summary', e.target.value)}
                              onInput={autoResize}
                              rows={4}
                              spellCheck={true}
                              className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none overflow-hidden"
                              placeholder="Brief overview of your background and goals..."
                            />
                            <p className="text-[10px] text-gray-400 mt-1 text-right">{(cv.summary || '').length}/1000 characters</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 1.1: Education — @dnd-kit sortable (touch-compatible) */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">Education</h2>
                          <button onClick={() => toggleSectionVisibility('education')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('education') ? 'Show in CV' : 'Hide from CV'}>
                            {hiddenSections.includes('education') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addArrayItem('education', { id: newId(), school: '', degree: '', field: '', startYear: '', endYear: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                      </div>
                      {cv.education.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No education entries. Click "Add" to start.</p>}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                        const { active, over } = e;
                        if (!over || active.id === over.id) return;
                        const oldIdx = cv.education.findIndex(item => item.id === active.id);
                        const newIdx = cv.education.findIndex(item => item.id === over.id);
                        if (oldIdx === -1 || newIdx === -1) return;
                        update('education', arrayMove(cv.education, oldIdx, newIdx));
                      }}>
                        <SortableContext items={cv.education.map(e => e.id)} strategy={verticalListSortingStrategy}>
                          {cv.education.map((edu, i) => (
                            <SortableItem key={edu.id} id={edu.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                              {cv.education.length > 1 && (
                                <button onClick={() => removeArrayItem('education', i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                              <span className="text-[10px] text-gray-400 font-medium block mb-2 pl-6">Drag to reorder</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">School / Institution</label><Input value={edu.school} onChange={e => updateArrayItem('education', i, 'school', e.target.value)} placeholder="Makerere University" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">Degree</label><Input value={edu.degree} onChange={e => updateArrayItem('education', i, 'degree', e.target.value)} placeholder="Bachelor of Science" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">Field of Study</label><Input value={edu.field} onChange={e => updateArrayItem('education', i, 'field', e.target.value)} placeholder="Computer Science" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">Start Year</label><Input value={edu.startYear} onChange={e => updateArrayItem('education', i, 'startYear', e.target.value)} placeholder="2018" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">End Year</label><Input value={edu.endYear} onChange={e => updateArrayItem('education', i, 'endYear', e.target.value)} placeholder="2022" className="sm:h-10" /></div>
                              </div>
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Phase 1.1: Experience — @dnd-kit sortable (touch-compatible) */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">Work Experience</h2>
                          <button onClick={() => toggleSectionVisibility('experience')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('experience') ? 'Show in CV' : 'Hide from CV'}>
                            {hiddenSections.includes('experience') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addArrayItem('experience', { id: newId(), company: '', position: '', startDate: '', endDate: '', current: false, description: '' })} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                      </div>
                      {cv.experience.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No experience entries. Click "Add" to start.</p>}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                        const { active, over } = e;
                        if (!over || active.id === over.id) return;
                        const oldIdx = cv.experience.findIndex(item => item.id === active.id);
                        const newIdx = cv.experience.findIndex(item => item.id === over.id);
                        if (oldIdx === -1 || newIdx === -1) return;
                        update('experience', arrayMove(cv.experience, oldIdx, newIdx));
                      }}>
                        <SortableContext items={cv.experience.map(e => e.id)} strategy={verticalListSortingStrategy}>
                          {cv.experience.map((exp, i) => (
                            <SortableItem key={exp.id} id={exp.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                              {cv.experience.length > 1 && (
                                <button onClick={() => removeArrayItem('experience', i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                              <span className="text-[10px] text-gray-400 font-medium block mb-2 pl-6">Drag to reorder</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs font-medium text-gray-600">Company</label><Input value={exp.company} onChange={e => updateArrayItem('experience', i, 'company', e.target.value)} placeholder="Google" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">Position</label><Input value={exp.position} onChange={e => updateArrayItem('experience', i, 'position', e.target.value)} placeholder="Software Engineer" className="sm:h-10" /></div>
                                <div><label className="text-xs font-medium text-gray-600">Start Date</label><Input value={exp.startDate} onChange={e => updateArrayItem('experience', i, 'startDate', e.target.value)} placeholder="Jan 2020" className="sm:h-10" /></div>
                                <div className="flex items-end gap-2">
                                  <div className="flex-1"><label className="text-xs font-medium text-gray-600">End Date</label><Input value={exp.endDate} onChange={e => updateArrayItem('experience', i, 'endDate', e.target.value)} placeholder="Present" disabled={exp.current} className="sm:h-10" /></div>
                                  <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-500 cursor-pointer shrink-0">
                                    <input type="checkbox" checked={exp.current} onChange={e => updateArrayItem('experience', i, 'current', e.target.checked)} className="rounded" />
                                    Current
                                  </label>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-medium text-gray-600">Description</label>
                                  <textarea value={exp.description} onChange={e => updateArrayItem('experience', i, 'description', e.target.value)} onInput={autoResize} rows={3} spellCheck={true} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none overflow-hidden" placeholder="Key responsibilities and achievements..." />
                                  {exp.description?.length > 0 && <p className="text-[10px] text-gray-400 mt-0.5 text-right">{exp.description.length}/2000 characters</p>}
                                </div>
                              </div>
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Step 3: Skills & Languages */}
                  {step === 3 && (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">Skills</h2>
                            <button onClick={() => toggleSectionVisibility('skills')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('skills') ? 'Show in CV' : 'Hide from CV'}>
                              {hiddenSections.includes('skills') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => update('skills', [...cv.skills, { id: newId(), name: '', level: 'Intermediate' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                            const { active, over } = e;
                            if (!over || active.id === over.id) return;
                            const oldIdx = cv.skills.findIndex(item => item.id === active.id);
                            const newIdx = cv.skills.findIndex(item => item.id === over.id);
                            if (oldIdx === -1 || newIdx === -1) return;
                            update('skills', arrayMove(cv.skills, oldIdx, newIdx));
                          }}>
                            <SortableContext items={cv.skills.map(s => s.id)} strategy={verticalListSortingStrategy}>
                              {cv.skills.map((skill, i) => (
                                <SortableItem key={skill.id} id={skill.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 flex-wrap sm:flex-nowrap">
                                  <input value={skill.name} onChange={e => { const s = [...cv.skills]; s[i] = { ...s[i], name: e.target.value }; update('skills', s); }} className="flex-1 text-sm text-gray-900 bg-transparent border-none outline-none min-w-[80px]" placeholder="e.g. JavaScript" />
                                  {/* Phase 1.4: Level picker — on mobile, opens bottom sheet */}
                                  <select
                                    value={skill.level}
                                    onChange={e => { const s = [...cv.skills]; s[i] = { ...s[i], level: e.target.value }; update('skills', s); }}
                                    onClick={e => {
                                      if (window.innerWidth < 768) {
                                        e.preventDefault();
                                        setBottomSheetField({ type: 'skills', index: i });
                                        setBottomSheetOptions(SKILL_LEVELS);
                                        setShowBottomSheet(true);
                                      }
                                    }}
                                    className={`text-xs sm:rounded-md sm:border sm:border-gray-200 px-1.5 py-0.5 bg-white font-medium md:block ${LEVEL_COLORS[skill.level] || LEVEL_COLORS.Intermediate}`}
                                  >
                                    {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                  </select>
                                  <button onClick={() => { const s = cv.skills.filter((_, j) => j !== i); update('skills', s); }} className="text-gray-400 hover:text-red-500 p-0.5 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                                </SortableItem>
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">Languages</h2>
                            <button onClick={() => toggleSectionVisibility('languages')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('languages') ? 'Show in CV' : 'Hide from CV'}>
                              {hiddenSections.includes('languages') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => update('languages', [...cv.languages, { id: newId(), name: '', level: 'Professional' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        <div className="space-y-2">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                            const { active, over } = e;
                            if (!over || active.id === over.id) return;
                            const oldIdx = cv.languages.findIndex(item => item.id === active.id);
                            const newIdx = cv.languages.findIndex(item => item.id === over.id);
                            if (oldIdx === -1 || newIdx === -1) return;
                            update('languages', arrayMove(cv.languages, oldIdx, newIdx));
                          }}>
                            <SortableContext items={cv.languages.map(l => l.id)} strategy={verticalListSortingStrategy}>
                              {cv.languages.map((lang, i) => (
                                <SortableItem key={lang.id} id={lang.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1.5 sm:px-3 sm:py-2 flex-wrap sm:flex-nowrap">
                                  <input value={lang.name} onChange={e => { const l = [...cv.languages]; l[i] = { ...l[i], name: e.target.value }; update('languages', l); }} className="flex-1 text-sm text-gray-900 bg-transparent border-none outline-none min-w-[80px]" placeholder="e.g. English" />
                                  <select
                                    value={lang.level}
                                    onChange={e => { const l = [...cv.languages]; l[i] = { ...l[i], level: e.target.value }; update('languages', l); }}
                                    onClick={e => {
                                      if (window.innerWidth < 768) {
                                        e.preventDefault();
                                        setBottomSheetField({ type: 'languages', index: i });
                                        setBottomSheetOptions(LANG_LEVELS);
                                        setShowBottomSheet(true);
                                      }
                                    }}
                                    className={`text-xs sm:rounded-md sm:border sm:border-gray-200 px-1.5 py-0.5 bg-white font-medium md:block ${LEVEL_COLORS[lang.level] || LEVEL_COLORS.Professional}`}
                                  >
                                    {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                  </select>
                                  <button onClick={() => { const l = cv.languages.filter((_, j) => j !== i); update('languages', l); }} className="text-gray-400 hover:text-red-500 p-0.5 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                                </SortableItem>
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold text-gray-900">Template</h2>
                          <span className="text-[10px] text-gray-400">{TEMPLATES.length} styles</span>
                        </div>
                        {/* Phase 1.7: Single column on mobile for larger tap targets */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-xs font-semibold">{t.name}</p>
                                {t.multiColumn && (
                                  <span className="text-[8px] text-amber-600 font-medium bg-amber-50 px-1 rounded">2-col ⚠️</span>
                                )}
                                {t.atsSafe && (
                                  <span className="text-[8px] text-green-600 font-medium bg-green-50 px-1 rounded">ATS ✅</span>
                                )}
                              </div>
                              <p className="text-[9px] text-gray-400 mt-0.5">{t.desc}</p>
                              {t.multiColumn && (
                                <p className="text-[7px] text-amber-500 mt-0.5">May cause ATS parsing issues</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Step 4: Style — Font & Color Settings */}
                  {step === 4 && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-4">Style Customization</h2>

                      {/* Font Family */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Font Family</label>
                        <select
                          value={cv.fontFamily || 'sans'}
                          onChange={e => update('fontFamily', e.target.value)}
                          className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="sans">Sans-serif (Modern)</option>
                          <option value="serif">Serif (Classic)</option>
                          <option value="mono">Monospace (Technical)</option>
                          <option value="system">System UI</option>
                          <option value="arial">Arial</option>
                          <option value="calibri">Calibri</option>
                          <option value="georgia">Georgia</option>
                          <option value="times">Times New Roman</option>
                          <option value="garamond">Garamond</option>
                          <option value="inter">Inter</option>
                          <option value="roboto">Roboto</option>
                          <option value="opensans">Open Sans</option>
                          <option value="poppins">Poppins</option>
                          <option value="montserrat">Montserrat</option>
                          <option value="lato">Lato</option>
                          <option value="raleway">Raleway</option>
                          <option value="nunito">Nunito</option>
                          <option value="quicksand">Quicksand</option>
                          <option value="merriweather">Merriweather</option>
                          <option value="playfair">Playfair Display</option>
                        </select>
                      </div>

                      {/* Font Size — dropdown 11px–72px */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Font Size</label>
                        <select
                          value={cv.fontSize || '14px'}
                          onChange={e => update('fontSize', e.target.value)}
                          className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          {Array.from({ length: 62 }, (_, i) => {
                            const px = i + 11;
                            return <option key={px} value={`${px}px`}>{px}px</option>;
                          })}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1.5">{cv.fontSize || '14px'} base text size</p>
                      </div>

                      {/* Heading Color — native color picker */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="text-xs font-medium text-gray-600 mb-3 block">Section Heading Color</label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <input
                              type="color"
                              value={cv.headingColor || '#2563eb'}
                              onChange={e => update('headingColor', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Pick a custom color"
                            />
                            <div
                              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              style={{ backgroundColor: cv.headingColor || '#2563eb' }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {cv.headingColor ? cv.headingColor.toUpperCase() : 'Default (Template)'}
                            </p>
                            <p className="text-[10px] text-gray-400">Click the circle to pick any color, or click <button onClick={() => update('headingColor', '')} className="text-primary underline">here</button> to reset to default</p>
                          </div>
                        </div>
                      </div>

                      {/* Header Background Color */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="text-xs font-medium text-gray-600 mb-3 block">Header Background Color</label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <input
                              type="color"
                              value={cv.headerBg || '#2563eb'}
                              onChange={e => update('headerBg', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Pick header background color"
                            />
                            <div
                              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              style={{ backgroundColor: cv.headerBg || '#2563eb' }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {cv.headerBg ? cv.headerBg.toUpperCase() : 'Default (Template)'}
                            </p>
                            <p className="text-[10px] text-gray-400">Choose header background, or <button onClick={() => update('headerBg', '')} className="text-primary underline">reset to default</button></p>
                          </div>
                        </div>
                      </div>

                      {/* Header Font Color */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="text-xs font-medium text-gray-600 mb-3 block">Header Text Color</label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <input
                              type="color"
                              value={cv.headerFontColor || '#ffffff'}
                              onChange={e => update('headerFontColor', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Pick header text color"
                            />
                            <div
                              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              style={{ backgroundColor: cv.headerFontColor || '#ffffff' }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {cv.headerFontColor ? cv.headerFontColor.toUpperCase() : 'Default (Template)'}
                            </p>
                            <p className="text-[10px] text-gray-400">Choose header text color, or <button onClick={() => update('headerFontColor', '')} className="text-primary underline">reset to default</button></p>
                          </div>
                        </div>
                      </div>

                      {/* Body Background Color */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="text-xs font-medium text-gray-600 mb-3 block">Body Background Color</label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <input
                              type="color"
                              value={cv.bodyBg || '#ffffff'}
                              onChange={e => update('bodyBg', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Pick body background color"
                            />
                            <div
                              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              style={{ backgroundColor: cv.bodyBg || '#ffffff' }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {cv.bodyBg ? cv.bodyBg.toUpperCase() : 'Default (White)'}
                            </p>
                            <p className="text-[10px] text-gray-400">Choose body background, or <button onClick={() => update('bodyBg', '')} className="text-primary underline">reset to white</button></p>
                          </div>
                        </div>
                      </div>

                      {/* Body Text Color */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="text-xs font-medium text-gray-600 mb-3 block">Body Text Color</label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <input
                              type="color"
                              value={cv.bodyTextColor || '#333333'}
                              onChange={e => update('bodyTextColor', e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Pick body text color"
                            />
                            <div
                              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              style={{ backgroundColor: cv.bodyTextColor || '#333333' }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {cv.bodyTextColor ? cv.bodyTextColor.toUpperCase() : 'Default (#333)'}
                            </p>
                            <p className="text-[10px] text-gray-400">Choose body text color, or <button onClick={() => update('bodyTextColor', '')} className="text-primary underline">reset to default</button></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5: More Sections (Certifications, Projects, References, Custom) */}
                  {step === 5 && (
                    <div className="space-y-6">
                      {/* Certifications */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">Certifications</h2>
                            <button onClick={() => toggleSectionVisibility('certifications')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('certifications') ? 'Show in CV' : 'Hide from CV'}>
                              {hiddenSections.includes('certifications') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => update('certifications', [...cv.certifications, { id: newId(), name: '', issuer: '', date: '', link: '', description: '' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        {cv.certifications.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No certifications yet.</p>}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                          const { active, over } = e;
                          if (!over || active.id === over.id) return;
                          const oldIdx = cv.certifications.findIndex(item => item.id === active.id);
                          const newIdx = cv.certifications.findIndex(item => item.id === over.id);
                          if (oldIdx === -1 || newIdx === -1) return;
                          update('certifications', arrayMove(cv.certifications, oldIdx, newIdx));
                        }}>
                          <SortableContext items={cv.certifications.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {cv.certifications.map((cert, i) => (
                          <SortableItem key={cert.id} id={cert.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                            {cv.certifications.length > 1 && (
                              <button onClick={() => update('certifications', cv.certifications.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                            {/* Note: GripVertical is rendered by SortableItem wrapper — no duplicate needed */}
                            <div className="flex items-center gap-1 mb-2 pl-6">
                              <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Certification Name</label><Input value={cert.name} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], name: e.target.value }; update('certifications', c); }} placeholder="e.g. Google Data Analytics" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Issuer</label><Input value={cert.issuer} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], issuer: e.target.value }; update('certifications', c); }} placeholder="Coursera / Google" /></div>
                              <div><label className="text-xs font-medium text-gray-600">Date</label><Input value={cert.date} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], date: e.target.value }; update('certifications', c); }} placeholder="2024" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Credential URL (optional)</label><Input value={cert.link} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], link: e.target.value }; update('certifications', c); }} placeholder="https://coursera.org/verify/..." /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Description (optional)</label>
                                <textarea value={cert.description} onChange={e => { const c = [...cv.certifications]; c[i] = { ...c[i], description: e.target.value }; update('certifications', c); }} rows={2} spellCheck={true} onInput={autoResize} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none overflow-hidden" placeholder="Key skills covered..." />
                              </div>
                            </div>
                          </SortableItem>
                        ))}
                          </SortableContext>
                        </DndContext>
                      </div>

                      {/* Projects */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">Projects</h2>
                            <button onClick={() => toggleSectionVisibility('projects')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('projects') ? 'Show in CV' : 'Hide from CV'}>
                              {hiddenSections.includes('projects') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => update('projects', [...cv.projects, { id: newId(), name: '', description: '', technologies: '', link: '' }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                        </div>
                        {cv.projects.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Add projects to showcase your work.</p>}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
                          const { active, over } = e;
                          if (!over || active.id === over.id) return;
                          const oldIdx = cv.projects.findIndex(item => item.id === active.id);
                          const newIdx = cv.projects.findIndex(item => item.id === over.id);
                          if (oldIdx === -1 || newIdx === -1) return;
                          update('projects', arrayMove(cv.projects, oldIdx, newIdx));
                        }}>
                          <SortableContext items={cv.projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        {cv.projects.map((proj, i) => (
                          <SortableItem key={proj.id} id={proj.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative mb-3">
                            {cv.projects.length > 1 && (
                              <button onClick={() => update('projects', cv.projects.filter((_, j) => j !== i))} className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                            {/* Note: GripVertical is rendered by SortableItem wrapper — no duplicate needed */}
                            <div className="flex items-center gap-1 mb-2 pl-6">
                              <span className="text-[10px] text-gray-400 font-medium">Drag to reorder</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Project Name</label><Input value={proj.name} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], name: e.target.value }; update('projects', p); }} placeholder="e.g. Bridge Jobs Platform" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Technologies Used</label><Input value={proj.technologies} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], technologies: e.target.value }; update('projects', p); }} placeholder="React, Node.js, PostgreSQL" /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Project URL (optional)</label><Input value={proj.link} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], link: e.target.value }; update('projects', p); }} placeholder="https://github.com/..." /></div>
                              <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600">Description</label>
                                <textarea value={proj.description} onChange={e => { const p = [...cv.projects]; p[i] = { ...p[i], description: e.target.value }; update('projects', p); }} rows={2} spellCheck={true} onInput={autoResize} className="w-full mt-1 text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none overflow-hidden" placeholder="What did you build? What problem does it solve?" />
                              </div>
                            </div>
                          </SortableItem>
                        ))}
                          </SortableContext>
                        </DndContext>
                      </div>

                      {/* References */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900">References</h2>
                            <button onClick={() => toggleSectionVisibility('references')} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={hiddenSections.includes('references') ? 'Show in CV' : 'Hide from CV'}>
                              {hiddenSections.includes('references') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
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
                            <h2 className="text-lg font-bold text-gray-900">Custom Sections</h2>
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
                                <textarea value={sec.content} onChange={e => { const s = [...cv.customSections]; s[i] = { ...s[i], content: e.target.value }; update('customSections', s); }} rows={3} spellCheck={true} onInput={autoResize} className="w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none overflow-hidden" placeholder="Enter your content here..." />
                              </div>
                            </div>
                          </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Step 6: Arrange Sections — Canva-style drag & drop */}
                  {step === 6 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Arrange Sections</h2>
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

                  {/* Step 7: Preview */}
                  {step === 7 && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <h2 className="text-lg font-bold text-gray-900">Preview & Download</h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { clearCV(); setCv(loadCV()); setUndoStack([]); toast.success('CV cleared'); }} className="text-red-500 hover:text-red-600 text-xs">Clear</Button>
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

                      {!cv.firstName && !cv.email && !cv.phone ? (
                        <div className="text-center py-12 text-gray-400">
                          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Your CV preview will appear here. Fill in your details in the previous steps.</p>
                        </div>
                      ) : (
                        <div ref={previewRef}>
                          <CVPreview data={{ ...cv, hiddenSections }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase 1.2+2.1+3.5: Mobile toolbar — Preview toggle + Undo + ATS Scan */}
                  <div className="flex sm:hidden gap-2 mb-3">
                    {undoStack.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1 text-xs" title="Undo last change">
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant={showMobilePreview ? 'default' : 'outline'} size="sm" onClick={() => setShowMobilePreview(prev => !prev)} className="gap-1 flex-1 text-xs">
                      <Eye className="w-3.5 h-3.5" /> {showMobilePreview ? 'Hide Preview' : 'Preview'}
                    </Button>
                  </div>

                  {/* Navigation — Phase 1.8: px-4 on mobile */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-100 px-4 sm:px-0">
                    <div className="flex gap-2 w-full sm:w-auto">
                      {undoStack.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleUndo} className="gap-1 text-xs text-gray-500 hover:text-gray-700" title="Undo last change (Ctrl+Z)">
                          <Undo2 className="w-3.5 h-3.5" /> Undo
                        </Button>
                      )}
                      <Button variant="default" onClick={prevStep} disabled={step === 0} className="gap-1 w-full sm:w-auto justify-center">
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </Button>
                    </div>
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

              {/* Sidebar preview */}
              <div className="lg:col-span-2 hidden lg:block">
                <div className="sticky top-24">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Live Preview
                    </h3>
                    <div style={{ transform: 'scale(0.65)', transformOrigin: 'top left', width: '153.8%' }}>
                      <CVPreview data={{ ...cv, hiddenSections }} compact />
                    </div>
                  </div>
                </div>
              </div>
            </div>            </motion.div>
        </div>
      </div>

      {/* Phase 1.2: Mobile floating preview button — hidden when modal is open */}
      {!showMobilePreview && (
        <button
          onClick={() => setShowMobilePreview(true)}
          className="fixed bottom-6 right-6 z-50 lg:hidden w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 hover:shadow-xl hover:-translate-y-0.5"
          aria-label="Preview CV"
        >
          <Eye className="w-6 h-6" />
        </button>
      )}

      {/* Phase 1.2: Mobile preview modal (fullscreen) */}
      {showMobilePreview && (
        <div className="fixed inset-0 z-50 lg:hidden bg-white overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h3 className="text-sm font-bold">CV Preview</h3>
            <button
              onClick={() => setShowMobilePreview(false)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            <CVPreview data={{ ...cv, hiddenSections }} />
          </div>
        </div>
      )}

      {/* Phase 1.4: Mobile bottom sheet for skill/language level */}
      {showBottomSheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowBottomSheet(false); setBottomSheetField(null); setBottomSheetOptions([]); }} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl animate-slide-up">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-sm font-bold">Select Level</h4>
              <button onClick={() => { setShowBottomSheet(false); setBottomSheetField(null); setBottomSheetOptions([]); }} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200">✕</button>
            </div>
            <div className="p-3 space-y-1">
              {bottomSheetOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    if (bottomSheetField) {
                      const { type, index } = bottomSheetField;
                      const arr = [...cv[type]];
                      arr[index] = { ...arr[index], level: opt };
                      update(type, arr);
                    }
                    setShowBottomSheet(false);
                    setBottomSheetField(null);
                    setBottomSheetOptions([]);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                    (bottomSheetField && cv[bottomSheetField.type]?.[bottomSheetField.index]?.level === opt)
                      ? 'bg-primary/10 text-primary'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    {(bottomSheetField && cv[bottomSheetField.type]?.[bottomSheetField.index]?.level === opt) && (
                      <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="h-6" /> {/* Safe area for notched phones */}
          </div>
        </div>
      )}

    </>
  );
}
