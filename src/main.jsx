import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import App from '@/App.jsx'
import { api } from '@/api/client'
import '@/index.css'

// Self-hosted fonts — latin subsets only, weights actually used across the site
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';

import inter400Url from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter600Url from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import pjs700Url from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2?url';

function preloadFont(url) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.crossOrigin = 'anonymous';
  link.href = url;
  document.head.appendChild(link);
}
preloadFont(inter400Url);
preloadFont(inter600Url);
preloadFont(pjs700Url);

const isNative = typeof window !== 'undefined' && window.Capacitor !== undefined;

function initGA(gaId) {
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', gaId);
}

async function loadGA() {
  if (isNative) return;
  try {
    const data = await api.settings.get('ga_measurement_id');
    if (data.value) initGA(data.value);
  } catch {}
}

if ('serviceWorker' in navigator && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

async function initApp() {
  if (isNative) {
    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#059669' });
    } catch {}
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch {}
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <App />
    </ThemeProvider>
  )
}

loadGA();
initApp();
