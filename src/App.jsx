import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from '@/lib/AuthContext';
import { HelmetProvider } from 'react-helmet-async';

const queryClient = new QueryClient();
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageNotFound from './lib/PageNotFound';
import CookieConsent from '@/components/CookieConsent';

import Login from '@/pages/Login';
import Home from '@/pages/Home';
import About from '@/pages/About';
import Services from '@/pages/Services';
import ContactForm from '@/pages/ContactForm';
import OpportunityDetail from '@/pages/OpportunityDetail';
import CategoryListings from '@/pages/CategoryListings';
import SearchResults from '@/pages/SearchResults';
import SavedOpportunities from '@/pages/SavedOpportunities';
import MyApplications from '@/pages/MyApplications';
import CVBuilder from '@/pages/CVBuilder';
import CVReview from '@/pages/CVReview';
import CVTips from '@/pages/CVTips';
import AIAssistant from '@/pages/AIAssistant';
import ServerError from '@/pages/ServerError';
import PublicLayout from './components/layout/PublicLayout';
import AdminRoute from '@/components/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOpportunities from './pages/admin/AdminOpportunities';
import AdminCategories from './pages/admin/AdminCategories';
import AdminMessages from './pages/admin/AdminMessages';
import AdminSiteSettings from './pages/admin/AdminSiteSettings';
import AdminSubscribers from './pages/admin/AdminSubscribers';
import AdminScraper from './pages/admin/AdminScraper';
import AdminScraperConfig from './pages/admin/AdminScraperConfig';
import AdminLists from './pages/admin/AdminLists';
import AdminPages from './pages/admin/AdminPages';
import AdminNews from './pages/admin/AdminNews';
import OpportunityForm from './pages/admin/OpportunityForm';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';

function AppContent() {
  const location = useLocation();
  return (
    <AuthProvider>
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatePresence mode="wait">
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
              <Route path="/saved" element={<SavedOpportunities />} />
              <Route path="/my-applications" element={<MyApplications />} />
              <Route path="/cv-builder" element={<CVBuilder />} />
              <Route path="/cv-review" element={<CVReview />} />
              <Route path="/cv-tips" element={<CVTips />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
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
                <Route path="lists" element={<AdminLists />} />
                <Route path="pages" element={<AdminPages />} />
                <Route path="news" element={<AdminNews />} />
              </Route>
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </AnimatePresence>
      </ErrorBoundary>
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
