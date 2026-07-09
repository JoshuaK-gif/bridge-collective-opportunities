import { useState } from 'react';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

export default function SubscribeButton() {
  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!subEmail) return;
    setSubscribing(true);
    try {
      await api.subscribers.subscribe(subEmail);
      toast.success('Subscribed to daily updates!');
      setSubEmail('');
      setShowForm(false);
    } catch {
      toast.error('Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {showForm ? (
        <form
          onSubmit={handleSubscribe}
          className="flex items-center gap-2 bg-white shadow-lg rounded-full border border-gray-200 p-1.5"
        >
          <input
            type="email"
            placeholder="your@email.com"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            required
            className="text-sm px-3 py-1.5 outline-none rounded-full w-40"
          />
          <button
            type="submit"
            disabled={subscribing}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {subscribing ? '...' : 'Subscribe'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gray-700 text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-gray-600 transition-colors text-sm font-semibold"
        >
          <Bell className="w-4 h-4" /> Subscribe
        </button>
      )}
    </div>
  );
}
