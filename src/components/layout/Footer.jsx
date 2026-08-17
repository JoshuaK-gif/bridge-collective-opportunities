import { Link } from 'react-router-dom';

const socials = [
  {
    name: 'WhatsApp',
    href: 'https://whatsapp.com/channel/0029Vb8Nr1KBPzjZzrhmfe24',
    color: 'bg-green-500',
    svg: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>,
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61591613761234',
    color: 'bg-blue-600',
    svg: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2Z"/>,
  },
  {
    name: 'X',
    href: 'https://x.com/',
    color: 'bg-black',
    svg: <path d="M4 4l6.5 7.5L4 20h2l5.5-6.5L17 20h5l-7-8.5L21 4h-2l-5 6L9 4H4zm2 1.5h3l10 13h-3L6 5.5z"/>,
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/',
    color: 'bg-blue-700',
    svg: <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z"/>,
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/bridgecollectiveopportunities',
    color: 'bg-pink-600',
    svg: <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 010 2.5 1.25 1.25 0 010-2.5M12 7a5 5 0 110 10 5 5 0 010-10m0 2a3 3 0 100 6 3 3 0 000-6z"/>,
  },
];

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 py-10 text-center">
        <div className="flex items-center justify-center gap-0 mb-2">
          <img src="https://res.cloudinary.com/et33rup2/image/upload/v1786959015/BCO.png" alt="BCO" className="h-20 md:h-28 w-auto" />
          <span className="font-bold text-[10px] md:text-xs leading-tight text-left text-accent">
            BRIDGE COLLECTIVE<br />OPPORTUNITIES
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Connecting talented people to the right opportunities
        </p>

        <div className="flex justify-center gap-2 sm:gap-3 mb-6 flex-wrap">
          {socials.map(s => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.name}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${s.color} transition-all hover:-translate-y-0.5 hover:brightness-110 group`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-white transition-colors">{s.svg}</svg>
            </a>
          ))}
        </div>

        <div className="flex justify-center gap-3 sm:gap-6 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Opportunities</Link>
          <Link to="/submit-opportunity" className="hover:text-foreground transition-colors">Submit an Opportunity</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </div>

        <p className="text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Bridge Collective Opportunities (BCO). All rights reserved.
        </p>
      </div>
    </footer>
  );
}
