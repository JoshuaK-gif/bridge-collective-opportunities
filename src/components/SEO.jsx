import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Bridge Collective Opportunities (BCO)';
const SITE_URL = 'https://www.bridgecollectiveopport.org';
const DEFAULT_DESC = 'Discover life-changing scholarships, grants, jobs, internships, fellowships, training and volunteer opportunities for youth in Uganda and East Africa. Apply today!';
const DEFAULT_IMAGE = 'https://res.cloudinary.com/et33rup2/image/upload/c_pad,w_1200,h_630,b_rgb:0f5e9e/v1786959015/BCO.png';
const TWITTER_HANDLE = '@bridgecollectiveug';
const LOCALE = 'en_US';

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  schema,
  publishedTime,
  author,
  keywords,
  noindex = false,
}) {
  const location = useLocation();

  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const pageDescription = description || DEFAULT_DESC;
  const pageImage = image || DEFAULT_IMAGE;
  const pageUrl = url || `${SITE_URL}${location.pathname}`;
  const schemaStr = schema ? JSON.stringify(schema) : null;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <link rel="canonical" href={pageUrl} />

      <meta name="description" content={pageDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={LOCALE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={pageUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
      <meta name="twitter:site" content={TWITTER_HANDLE} />

      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {author && <meta property="article:author" content={author} />}

      {schemaStr && (
        <script type="application/ld+json">{schemaStr}</script>
      )}
    </Helmet>
  );
}
