import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

export default function TermsOfService() {
  return (
    <>
      <SEO
        title="Terms of Service"
        description="Bridge Collective Opportunities Terms of Service — terms governing the use of our platform for finding scholarships, jobs, grants and opportunities."
        noindex
      />
    <div className="min-h-screen bg-[#eef0fa]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-10 space-y-6">
          <Link to="/" className="text-sm text-primary hover:underline">&larr; Back to Home</Link>
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: July 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">By accessing Bridge Collective Opportunities ("the Platform"), you agree to these Terms of Service. If you do not agree, please do not use the Platform.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">2. Use of Service</h2>
            <p className="text-gray-600 leading-relaxed">The Platform provides information about scholarships, grants, jobs, internships, and fellowships. We do not guarantee the accuracy, completeness, or timeliness of third-party listings. All opportunities are subject to the respective provider's terms.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">3. User Conduct</h2>
            <p className="text-gray-600 leading-relaxed">You agree not to misuse the Platform, scrape content, submit false information, or engage in any activity that disrupts the service for others.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">4. Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">All content created by Bridge Collective (text, design, code) is our intellectual property. Third-party listings remain the property of their respective owners.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">5. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">Bridge Collective is not responsible for any damages arising from use of the Platform or reliance on listed opportunities. We provide the service "as is" without warranties of any kind.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">6. Changes</h2>
            <p className="text-gray-600 leading-relaxed">We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">7. Contact</h2>
            <p className="text-gray-600 leading-relaxed">Questions? Email: <a href="mailto:support@bridgejobs.ug" className="text-primary hover:underline">support@bridgejobs.ug</a></p>
          </section>
        </div>
      </div>
    </div>
    </>
  );
}
