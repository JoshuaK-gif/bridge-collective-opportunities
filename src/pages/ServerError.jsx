import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

export default function ServerError() {
  return (
    <>
      <SEO title="Server Error" description="Something went wrong on our end. Please try again later." noindex />
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-red-300">500</h1>
            <div className="h-0.5 w-16 bg-red-200 mx-auto" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-medium text-gray-800">Server Error</h2>
            <p className="text-gray-500 text-sm">Something went wrong. Please try again later.</p>
          </div>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
