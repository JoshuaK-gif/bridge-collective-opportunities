import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, CheckCircle2, AlertTriangle, Star, FileText, Target, Eye, ListChecks } from 'lucide-react';
import SEO from '@/components/SEO';

const tips = [
  {
    icon: FileText,
    title: 'Keep It One Page',
    desc: 'For most youth opportunities, a one-page CV is ideal. Recruiters spend an average of 6 seconds scanning a CV. Make every word count.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Target,
    title: 'Tailor for Each Opportunity',
    desc: 'Never send the same CV everywhere. Adjust your summary and skills to match what each specific opportunity asks for. Use keywords from the job description.',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    icon: Eye,
    title: 'Use a Clean, Professional Design',
    desc: 'Use consistent fonts, clear section headings, and plenty of white space. Avoid fancy graphics or colors that distract from your content.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: ListChecks,
    title: 'Highlight Achievements, Not Duties',
    desc: 'Instead of "Responsible for social media", write "Grew Instagram following by 200% in 3 months." Use numbers and specific results.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: CheckCircle2,
    title: 'Include a Professional Summary',
    desc: 'A 2-3 sentence summary at the top of your CV tells recruiters who you are and what you\'re looking for. Make it compelling and specific.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    icon: AlertTriangle,
    title: 'Avoid Common Mistakes',
    desc: 'Check for typos, use a professional email address (not partyboy123@gmail.com), save as PDF, and never lie on your CV.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
];

const dos = [
  'Use action verbs (managed, developed, led, created)',
  'Quantify your achievements with numbers',
  'Keep formatting consistent throughout',
  'Include relevant keywords from the opportunity',
  'List skills that are actually relevant',
  'Proofread at least twice',
  'Save and send as PDF',
  'Use a clear file name (John_Doe_CV.pdf)',
];

const donts = [
  'Use generic objectives like "seeking a challenging position"',
  'Include irrelevant work experience',
  'Use unprofessional email addresses',
  'Add references unless requested',
  'Include your photo (not standard in most countries)',
  'Use overly complex formatting or tables',
  'Lie or exaggerate your experience',
  'Send the same CV to every opportunity',
];

export default function CVTips() {
  return (
    <>
      <SEO title="CV Writing Tips" description="Learn how to write a standout CV that gets you noticed by employers and opportunity providers." />
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-gray-900">CV Writing Tips</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">Expert advice to help you create a CV that stands out to employers and opportunity providers.</p>

            {/* Tips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {tips.map((tip, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`${tip.bg} rounded-xl p-5 border border-gray-100`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${tip.bg} flex items-center justify-center shrink-0`}>
                      <tip.icon className={`w-5 h-5 ${tip.color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">{tip.title}</h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Do / Don't */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-bold text-sm flex items-center gap-2 mb-4 text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Do
                </h2>
                <ul className="space-y-2.5">
                  {dos.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-bold text-sm flex items-center gap-2 mb-4 text-red-700">
                  <AlertTriangle className="w-4 h-4" /> Don't
                </h2>
                <ul className="space-y-2.5">
                  {donts.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 text-center bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/20">
              <Star className="w-8 h-8 text-primary mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Ready to Build Your CV?</h2>
              <p className="text-sm text-gray-600 mb-4">Use our free CV builder to create a professional CV in minutes.</p>
              <Link to="/cv-builder" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                <FileText className="w-4 h-4" /> Build Your CV Now
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
