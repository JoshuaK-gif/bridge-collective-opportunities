import { Sparkles } from 'lucide-react';

export default function AssistanceButton() {
  return (
    <a
      href="https://bridge-collective-intelligence.vercel.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-full shadow-lg hover:scale-105 transition-transform font-medium text-sm"
      title="AI Assistant"
    >
      <Sparkles className="w-4 h-4" />
      <span className="hidden sm:inline">Assistance</span>
    </a>
  );
}
