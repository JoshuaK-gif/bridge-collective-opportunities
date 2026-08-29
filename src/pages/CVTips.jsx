import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, CheckCircle2, AlertTriangle, Star, FileText, Target, Eye, ListChecks, Users, Globe } from 'lucide-react';
import SEO from '@/components/SEO';

const iconMap = {
  FileText, Target, Eye, ListChecks, CheckCircle2,
  AlertTriangle, Star, Lightbulb, Users, Globe,
};

const colorMap = {
  FileText: 'text-blue-600', Target: 'text-green-600', Eye: 'text-purple-600',
  ListChecks: 'text-orange-600', CheckCircle2: 'text-teal-600',
  AlertTriangle: 'text-red-600', Star: 'text-amber-600',
  Lightbulb: 'text-amber-500', Users: 'text-indigo-600', Globe: 'text-sky-600',
};

const bgMap = {
  FileText: 'bg-blue-50', Target: 'bg-green-50', Eye: 'bg-purple-50',
  ListChecks: 'bg-orange-50', CheckCircle2: 'bg-teal-50',
  AlertTriangle: 'bg-red-50', Star: 'bg-amber-50',
  Lightbulb: 'bg-amber-50', Users: 'bg-indigo-50', Globe: 'bg-sky-50',
};

const page_title = 'CV Tips: How to Build an Application That Gets Noticed';
const page_subtitle = 'A strong CV is often the difference between an application that gets read and one that gets skipped. Whether you are applying for a job, an internship, a scholarship, or a fellowship, these guidelines will help you present yourself clearly and professionally.';
const tips = [
  { icon: 'FileText', title: 'Start With a Clean, Consistent Structure', desc: 'Recruiters and selection panels often review dozens of applications in a single sitting. Make it easy for them: Use clear section headings (Personal Details, Summary, Education, Experience, Skills, Achievements, References). Keep formatting consistent with one font, one size for body text, one style for headings. Stick to 1\u20132 pages. Save and submit as a PDF.' },
  { icon: 'Target', title: 'Open With a Strong Summary', desc: 'A 2\u20133 sentence summary at the top tells the reader who you are and what you bring before they reach your experience section. Focus on your field, your strongest skill, and what you are looking for.' },
  { icon: 'ListChecks', title: 'Lead With Achievements, Not Just Duties', desc: 'Listing what a role involved is less convincing than showing what you achieved in it. Where possible, quantify your impact. If you do not have numbers, describe the outcome: what changed because you did the work.' },
  { icon: 'Eye', title: 'Tailor Your CV to Each Opportunity', desc: 'A generic CV sent to every opportunity is easy to spot and easy to reject. Re-read the opportunity description, reorder or rephrase your experience so the most relevant items come first, and match keywords where genuinely true.' },
  { icon: 'CheckCircle2', title: 'Keep Language Simple and Professional', desc: 'Use active verbs like led, built, coordinated, designed, analyzed. Avoid jargon the reader might not know. Proofread carefully and ask someone else to read it before you submit.' },
  { icon: 'AlertTriangle', title: 'Common Mistakes to Avoid', desc: 'Do not include a photo, age, or marital status unless specifically requested. Do not list every task from every role instead of the most relevant ones. Do not leave unexplained gaps without a brief note. Do not use an unprofessional email address. Do not forget to update contact details.' },
];
const dos = [
  'Use action verbs (led, built, coordinated, designed, analyzed)',
  'Quantify your achievements with numbers',
  'Keep formatting consistent throughout',
  'Include relevant keywords from the opportunity',
  'Highlight achievements relevant to this specific opportunity',
  'Include up-to-date contact information',
  'Save and send as a clearly named PDF (e.g. FirstName_LastName_CV.pdf)',
  'Proofread at least twice before submitting',
];
const donts = [
  'Include a photo, age, or marital status unless specifically requested',
  'List every task from every role instead of the most relevant ones',
  'Leave unexplained gaps without a brief note',
  'Use an unprofessional email address',
  'Forget to update contact details',
  'Lie or exaggerate your experience',
  'Send the same CV to every opportunity',
  'Use overly complex formatting or tables',
];

export default function CVTips() {

  return (
    <>
      <SEO title={page_title} description={page_subtitle} />
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-gray-900">{page_title}</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">{page_subtitle}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {tips.map((tip, i) => {
                const Icon = iconMap[tip.icon] || Lightbulb;
                const color = tip.color || colorMap[tip.icon] || 'text-blue-600';
                const bg = tip.bg || bgMap[tip.icon] || 'bg-blue-50';
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`${bg} rounded-xl p-5 border border-gray-100`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">{tip.title}</h3>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{tip.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

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
