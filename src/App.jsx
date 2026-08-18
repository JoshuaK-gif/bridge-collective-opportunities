import { lazy, Suspense, useState, useEffect } from 'react';
import { Toaster } from 'sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageNotFound from './lib/PageNotFound';
import CookieConsent from '@/components/CookieConsent';
import PublicLayout from './components/layout/PublicLayout';
import AdminRoute from '@/components/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import { getFeatures } from '@/lib/features';

// Route-based code splitting — pages load on-demand
const Home = lazy(() => import('@/pages/Home'));
const About = lazy(() => import('@/pages/About'));
const Services = lazy(() => import('@/pages/Services'));
const ContactForm = lazy(() => import('@/pages/ContactForm'));
const OpportunityDetail = lazy(() => import('@/pages/OpportunityDetail'));
const CategoryListings = lazy(() => import('@/pages/CategoryListings'));
const SearchResults = lazy(() => import('@/pages/SearchResults'));
const Login = lazy(() => import('@/pages/Login'));
const SavedOpportunities = lazy(() => import('@/pages/SavedOpportunities'));
const MyApplications = lazy(() => import('@/pages/MyApplications'));
const CVBuilder = lazy(() => import('@/pages/CVBuilder'));
const CVReview = lazy(() => import('@/pages/CVReview'));
const CVTips = lazy(() => import('@/pages/CVTips'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const GenerateAssistant = lazy(() => import('@/pages/GenerateAssistant'));
const PolishAssistant = lazy(() => import('@/pages/PolishAssistant'));
const GrantCheckAssistant = lazy(() => import('@/pages/GrantCheckAssistant'));
const ServerError = lazy(() => import('@/pages/ServerError'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const SubmitOpportunity = lazy(() => import('@/pages/SubmitOpportunity'));

// Admin pages — only loaded when user visits /admin-bridgejobs
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminOpportunities = lazy(() => import('@/pages/admin/AdminOpportunities'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const AdminSiteSettings = lazy(() => import('@/pages/admin/AdminSiteSettings'));
const AdminSubscribers = lazy(() => import('@/pages/admin/AdminSubscribers'));
const AdminScraper = lazy(() => import('@/pages/admin/AdminScraper'));
const AdminScraperConfig = lazy(() => import('@/pages/admin/AdminScraperConfig'));
const AdminDraftEditor = lazy(() => import('@/pages/admin/AdminDraftEditor'));
const AdminLists = lazy(() => import('@/pages/admin/AdminLists'));
const AdminPages = lazy(() => import('@/pages/admin/AdminPages'));
const AdminNews = lazy(() => import('@/pages/admin/AdminNews'));
const OpportunityForm = lazy(() => import('@/pages/admin/OpportunityForm'));
const AdminTemplates = lazy(() => import('@/pages/admin/AdminTemplates'));
const AIExtractFromUrl = lazy(() => import('@/pages/admin/AIExtractFromUrl'));
const AdminCvTips = lazy(() => import('@/pages/admin/AdminCvTips'));

// Loading spinner for lazy-loaded routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const [features, setFeatures] = useState(null);

  useEffect(() => {
    getFeatures().then(setFeatures);
  }, []);

  return (
    <AuthProvider>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/contact" element={<ContactForm />} />
                <Route path="/opportunities/:id" element={<OpportunityDetail />} />
                <Route path="/category/:category" element={<CategoryListings />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/submit-opportunity" element={<SubmitOpportunity />} />
                <Route path="/saved" element={<SavedOpportunities />} />
                <Route path="/my-applications" element={<MyApplications />} />
                <Route path="/cv-builder" element={<CVBuilder />} />
                <Route path="/cv-review" element={<CVReview />} />
                <Route path="/cv-tips" element={<CVTips />} />
                {features?.ai !== false && (
                  <>
                    <Route path="/ai-assistant" element={<AIAssistant />} />
                    <Route path="/ai-assistant/generate" element={<GenerateAssistant />} />
                    <Route path="/ai-assistant/polish" element={<PolishAssistant />} />
                  </>
                )}
                {features?.grantAssistant !== false && (
                  <Route path="/ai-assistant/check" element={<GrantCheckAssistant />} />
                )}
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/500" element={<ServerError />} />
              <Route path="/admin-bridgejobs" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="opportunities" element={<AdminOpportunities />} />
                  <Route path="opportunities/new" element={<OpportunityForm />} />
                  <Route path="opportunities/:id/edit" element={<OpportunityForm />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="settings" element={<AdminSiteSettings />} />
                  <Route path="subscribers" element={<AdminSubscribers />} />
                  <Route path="scraper" element={<AdminScraper />} />
                  <Route path="scraper/config" element={<AdminScraperConfig />} />
                  <Route path="scraper/drafts/:id" element={<AdminDraftEditor />} />
                  <Route path="lists" element={<AdminLists />} />
                  <Route path="pages" element={<AdminPages />} />
                  <Route path="news" element={<AdminNews />} />
                  <Route path="templates" element={<AdminTemplates />} />
                  <Route path="ai-extract" element={<AIExtractFromUrl />} />
                  <Route path="cv-tips" element={<AdminCvTips />} />
                </Route>
              </Route>            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
      <CookieConsent />
    </AuthProvider>
  );
}

function App() {
  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
    </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
