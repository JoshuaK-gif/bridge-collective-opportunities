import { Link } from 'react-router-dom';
import { FileText, Wrench, ArrowLeft } from 'lucide-react';
import SEO from '@/components/SEO';

export default function ResumeBuilder() {
  return (
    <>
      <SEO
        title="Resume Builder"
        description="Our Resume Builder is coming soon. Create a professional resume with Bridge Collective Opportunities."
        noindex
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 px-4">
        <div className="max-w-3xl w-full text-center space-y-8 py-16">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 text-primary mx-auto">
            <FileText className="w-12 h-12" />
          </div>

          <div className="space-y-4">
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.05]">
              Resume Builder
            </h1>
            <div className="h-1 w-28 bg-primary mx-auto rounded-full" />
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">
              Still Under Development
            </p>
          </div>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            We are working hard to bring you a powerful resume builder that helps you
            stand out. Check back soon — it is on the way!
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-sm font-medium">
              <Wrench className="w-4 h-4" /> Coming Soon
            </span>
          </div>

          <div className="pt-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
