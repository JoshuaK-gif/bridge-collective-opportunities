/**
 * Loads the Google Fonts used by CV templates on demand.
 *
 * The main site only uses Inter + Plus Jakarta Sans (loaded in index.html).
 * CV templates offer many more fonts (Poppins, Roboto, Lato, etc.), which
 * used to be loaded on every page. We inject them only when the CV builder
 * mounts, so the rest of the site stays fast.
 */

const CV_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800' +
  '&family=Roboto:wght@400;500;700' +
  '&family=Open+Sans:wght@400;600;700' +
  '&family=Poppins:wght@400;500;600;700' +
  '&family=Montserrat:wght@400;500;600;700' +
  '&family=Lato:wght@400;700' +
  '&family=Raleway:wght@400;500;600;700' +
  '&family=Nunito:wght@400;600;700' +
  '&family=Quicksand:wght@400;500;600;700' +
  '&family=Merriweather:wght@400;700' +
  '&family=Playfair+Display:wght@400;600;700' +
  '&family=JetBrains+Mono:wght@400;700' +
  '&family=EB+Garamond:wght@400;600' +
  '&display=swap';

let loaded = false;

/** Inject the CV font stylesheet once, and resolve when fonts are ready. */
export function loadCvFonts() {
  if (loaded) return Promise.resolve();
  loaded = true;

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CV_FONTS_URL;
    link.onload = () => {
      // Fonts still need to actually download; wait for the face to be usable.
      Promise.resolve(document.fonts?.ready).then(() => resolve());
    };
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export default { loadCvFonts };
