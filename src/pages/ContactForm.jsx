import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import SEO from '../components/shared/SEO';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { Mail, Phone, MapPin, Clock, Send, MessageSquare } from 'lucide-react';

const contactInfo = [
  { icon: Mail, label: 'Email', value: 'bridgecollectiveopportunities@gmail.com', href: 'mailto:bridgecollectiveopportunities@gmail.com', color: 'text-blue-600', bg: 'bg-blue-100' },
  { icon: Phone, label: 'Phone', value: '+256 741 052 195', href: 'tel:+256741052195', color: 'text-green-600', bg: 'bg-green-100' },
  { icon: MapPin, label: 'Location', value: 'Kampala, Uganda', color: 'text-orange-600', bg: 'bg-orange-100' },
  { icon: Clock, label: 'Response Time', value: 'Within 24 hours', color: 'text-blue-600', bg: 'bg-blue-100' },
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.messages.send(formData);
      toast.success("Thank you for your message! We will get back to you soon.");
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch {
      toast.error("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEO title="Contact" description="Get in touch with the Bridge Collective Opportunities team. We're here to help with your hiring and job search needs." />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-green-500 py-20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <MessageSquare className="w-12 h-12 text-white/80 mx-auto mb-4" />
          <h1 className="font-heading font-bold text-4xl sm:text-5xl md:text-6xl text-white mb-4">
            Get in <span className="text-orange-200">Touch</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
            Have questions or need assistance? Reach out to our team, and we'll be happy to help.
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="relative -mt-10 z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {contactInfo.map((info, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center hover:shadow-xl transition-all hover:-translate-y-1">
              <div className={`w-12 h-12 rounded-xl ${info.bg} flex items-center justify-center mx-auto mb-3 ${info.color}`}>
                <info.icon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{info.label}</h3>
              {info.href ? (
                <a href={info.href} className="text-xs font-semibold text-gray-900 hover:text-blue-600 transition-colors break-all">
                  {info.value}
                </a>
              ) : (
                <p className="text-xs font-semibold text-gray-900">{info.value}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Form + Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-5 gap-10 items-start">
          {/* Form */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Send us a message</h2>
                  <p className="text-sm text-gray-500">We'll respond within 24 hours</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name</label>
                    <Input
                      required
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email Address</label>
                    <Input
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="h-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
                  <Input
                    required
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
                  <Textarea
                    required
                    placeholder="Tell us more about your inquiry..."
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="min-h-[160px] resize-y"
                  />
                </div>
                <Button type="submit" className="mx-auto block" disabled={sending}>
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" /> Send Message
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-green-600 rounded-2xl p-8 text-white">
              <h3 className="font-bold text-lg mb-3">Why contact us?</h3>
              <ul className="space-y-3">
                {[
                  'Questions about opportunities',
                  'Partnership inquiries',
                  'Technical support',
                  'Feedback & suggestions',
                  'Media & press',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-3">Follow us</h3>
              <p className="text-sm text-gray-500 mb-4">Stay connected on social media for the latest opportunities.</p>
              <div className="flex gap-3">
                {[
                  { name: 'WhatsApp', href: 'https://whatsapp.com/channel/0029Vb8Nr1KBPzjZzrhmfe24' },
                  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591613761234' },
                  { name: 'X', href: 'https://x.com/' },
                  { name: 'LinkedIn', href: 'https://linkedin.com/' },
                ].map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-all"
                    title={s.name}
                  >
                    <span className="text-xs font-bold">{s.name[0]}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
