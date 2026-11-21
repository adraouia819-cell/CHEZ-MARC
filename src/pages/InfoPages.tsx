import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { apiFetch, formatMad } from '../lib/api.ts';
import type { ShippingZone, StoreSettings } from '../types/index.ts';

interface ContactPageProps {
  settings: StoreSettings | null;
}

export function ContactPage({ settings }: ContactPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, phone, subject, message }),
      });
      setSent(true);
      setFullName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="pb-8 border-b border-[#E6DFD5]">
        <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Showroom & Conciergerie</p>
        <h1 className="mt-2 font-display text-3xl lg:text-5xl font-medium text-[#111111]">
          Contacter {settings?.store_name || 'CASA STYLE'}
        </h1>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        <div className="lg:col-span-5 space-y-6">
          <p className="text-sm leading-relaxed text-[#5A554E]">
            Notre atelier et showroom de Casablanca vous accueillent sur rendez-vous pour découvrir les collections, ajuster une coupe ou suivre une commande spéciale.
          </p>

          <div className="bg-white border border-[#E6DFD5] p-6 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#9A7D43] mt-1 shrink-0" />
              <div>
                <p className="font-semibold text-[#111111]">Boutique Casablanca</p>
                <p className="text-xs text-[#5A554E] mt-0.5">{settings?.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#9A7D43] mt-1 shrink-0" />
              <div>
                <p className="font-semibold text-[#111111]">Téléphone & WhatsApp</p>
                <p className="text-xs text-[#5A554E] mt-0.5">Tél : {settings?.phone} · WhatsApp : {settings?.whatsapp}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#9A7D43] mt-1 shrink-0" />
              <div>
                <p className="font-semibold text-[#111111]">E-mail & Réseaux</p>
                <p className="text-xs text-[#5A554E] mt-0.5">{settings?.email} · Instagram {settings?.instagram}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E6DFD5] p-6 lg:p-8">
          {sent ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-[#166534] mx-auto" />
              <h2 className="font-display text-2xl text-[#111111]">Message transmis</h2>
              <p className="text-sm text-[#5A554E]">Notre équipe casablancaise vous répondra sous 24 heures ouvrées.</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-4 px-5 py-2.5 border border-[#111111] text-xs uppercase tracking-wider cursor-pointer"
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-display text-2xl text-[#111111] mb-2">Écrire à l’atelier</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">E-mail *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">Objet *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Conseil taille, commande, presse..."
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Message *</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                />
              </div>
              {error && <p className="text-xs text-[#991B1B]">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="px-7 py-3 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] cursor-pointer"
              >
                {submitting ? 'Envoi...' : 'Envoyer le message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

interface PolicyPageProps {
  settings: StoreSettings | null;
  shippingZones: ShippingZone[];
}

export function PolicyPage({ settings, shippingZones }: PolicyPageProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 lg:px-10 py-12 lg:py-16 space-y-12">
      <div className="pb-6 border-b border-[#E6DFD5]">
        <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Engagements Maison</p>
        <h1 className="mt-2 font-display text-3xl lg:text-5xl font-medium text-[#111111]">
          Livraison & Politique de Retour
        </h1>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-[#111111]">Zones & Tarifs de livraison au Maroc</h2>
        <div className="overflow-x-auto bg-white border border-[#E6DFD5]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6DFD5] bg-[#F2ECE3]/60 text-xs text-[#5A554E] uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Zone</th>
                <th className="py-3 px-4 font-medium">Délai estimé</th>
                <th className="py-3 px-4 font-medium text-right">Frais standard</th>
                <th className="py-3 px-4 font-medium text-right">Offerte dès</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DFD5] tabular-nums">
              {shippingZones.map((z) => (
                <tr key={z.id}>
                  <td className="py-3 px-4 font-medium text-[#111111]">{z.zone_name}</td>
                  <td className="py-3 px-4 text-[#5A554E]">{z.estimated_days}</td>
                  <td className="py-3 px-4 text-right text-[#111111]">{formatMad(z.fee_mad)}</td>
                  <td className="py-3 px-4 text-right text-[#111111]">{formatMad(z.free_above_mad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 bg-white border border-[#E6DFD5] p-6 lg:p-8">
        <h2 className="font-display text-2xl text-[#111111]">Politique de retour et d’échange</h2>
        <p className="text-sm leading-relaxed text-[#5A554E] whitespace-pre-line">
          {settings?.return_policy_text}
        </p>
      </section>

      <section className="space-y-3 bg-white border border-[#E6DFD5] p-6 lg:p-8">
        <h2 className="font-display text-2xl text-[#111111]">Conditions générales de vente</h2>
        <p className="text-sm leading-relaxed text-[#5A554E] whitespace-pre-line">
          {settings?.terms_text}
        </p>
      </section>
    </main>
  );
}
