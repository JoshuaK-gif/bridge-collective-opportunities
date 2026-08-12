import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import BottomNav from './BottomNav';
import BackToTop from './BackToTop';

export default function PublicLayout() {
  const handleSearchTap = () => {
    const el = document.querySelector('#mobile-search-input');
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-14 md:pb-0 select-none">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomNav onSearchTap={handleSearchTap} />
      <BackToTop />
    </div>
  );
}