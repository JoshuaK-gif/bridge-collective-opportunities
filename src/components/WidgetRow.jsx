import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function MiniCarousel({ title, items = [], borderColor }) {
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, items.length - 1);

  if (items.length === 0) return null;

  const current = items[index];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`h-1 ${borderColor}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700">{title}</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
              disabled={index === maxIndex}
              className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        <Link to={`/opportunities/${current.id}`} className="group block">
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-2 bg-gray-100">
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/90 text-white">
              {current.category}
            </div>
          </div>
          <h4 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {current.title}
          </h4>
          {current.deadline && (
            <p className="text-xs text-gray-400 mt-1">Deadline: {current.deadline}</p>
          )}
        </Link>
      </div>
    </div>
  );
}

function CtaBanner() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-1 bg-green-500" />
      <div className="p-4">
        <div
          className="relative rounded-lg overflow-hidden bg-gradient-to-br from-green-500 via-emerald-400 to-teal-300 p-5 flex flex-col items-center text-center"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-2 left-2 w-16 h-16 rounded-full bg-white" />
            <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-white" />
            <div className="absolute top-1/2 left-1/3 w-8 h-8 rounded-full bg-white" />
          </div>
          <h3 className="relative text-white font-extrabold text-lg uppercase tracking-wide mb-1">
            Join Our Community
          </h3>
          <p className="relative text-white/80 text-xs mb-4 max-w-xs">
            Get exclusive opportunities, tips, and updates straight to your phone
          </p>
          <a
            href="https://whatsapp.com/channel/0029Vb8Nr1KBPzjZzrhmfe24"
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-2 bg-white text-green-700 font-bold px-6 py-2.5 rounded-full text-sm shadow-md hover:bg-green-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            CLICK HERE!
          </a>
        </div>
      </div>
    </div>
  );
}

export default function WidgetRow({ grants = [], competitions = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MiniCarousel title="Grants" items={grants} borderColor="bg-amber-500" />
      <MiniCarousel title="Competition" items={competitions} borderColor="bg-blue-500" />
      <CtaBanner />
    </div>
  );
}
