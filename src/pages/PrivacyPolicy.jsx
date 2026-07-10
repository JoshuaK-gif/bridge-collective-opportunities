import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Bridge Collective Opportunities Privacy Policy — how we collect, use, and protect your personal data when you use our platform."
        noindex
      />
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-10 space-y-6">
          <Link to="/" className="text-sm text-primary hover:underline">&larr; Back to Home</Link>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: July 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">1. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed">We collect information you provide directly, such as your name and email when subscribing to our newsletter or contacting us. We also collect browsing data via cookies and analytics tools (Google Analytics) to improve our service.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">2. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed">We use your information to send newsletters (if subscribed), respond to inquiries, improve our platform, and analyze usage patterns. We never sell your personal data.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">3. Cookies</h2>
            <p className="text-gray-600 leading-relaxed">We use essential cookies for site functionality and analytics cookies (if you consent) to understand how visitors interact with the site. You can manage preferences via your browser settings.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">4. Data Storage & Security</h2>
            <p className="text-gray-600 leading-relaxed">Your data is stored securely on Supabase (PostgreSQL) servers. We implement industry-standard security measures but cannot guarantee absolute security of data transmission over the internet.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">5. Third-Party Services</h2>
            <p className="text-gray-600 leading-relaxed">We may use third-party services (Google Analytics, Sentry, Cloudinary) that collect data subject to their own privacy policies. We do not control these third parties.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">6. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed">You may request access to, correction of, or deletion of your personal data. Email us at <a href="mailto:support@bridgejobs.ug" className="text-primary hover:underline">support@bridgejobs.ug</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">7. Contact</h2>
            <p className="text-gray-600 leading-relaxed">For questions about this policy, contact: <a href="mailto:support@bridgejobs.ug" className="text-primary hover:underline">support@bridgejobs.ug</a></p>
          </section>
        </div>
      </div>
    </div>
    </>
  );
}
