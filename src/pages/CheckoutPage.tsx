import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Printer, ShieldCheck, Tag } from 'lucide-react';
import { apiFetch, formatMad } from '../lib/api.ts';
import type { AuthUser, CartItem, Order } from '../types/index.ts';

interface CheckoutPageProps {
  items: CartItem[];
  currentUser: AuthUser | null;
  onOrderSuccess: () => void;
  onBackToShop: () => void;
}

const MOROCCAN_CITIES = [
  'Casablanca',
  'Rabat',
  'Marrakech',
  'Tanger',
  'Agadir',
  'Fès',
  'Meknès',
  'Mohammedia',
  'Kénitra',
  'Oujda',
  'Tétouan',
  'Autre ville du Maroc',
];

export function CheckoutPage({ items, currentUser, onOrderSuccess, onBackToShop }: CheckoutPageProps) {
  const [customerName, setCustomerName] = useState(currentUser?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [city, setCity] = useState('Casablanca');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [discountMad, setDiscountMad] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');

  const [shippingInfo, setShippingInfo] = useState<{
    zoneName: string;
    feeMad: number;
    freeAboveMad: number;
    estimatedDays: string;
  }>({
    zoneName: 'Casablanca & Grand Casablanca',
    feeMad: 30,
    freeAboveMad: 1500,
    estimatedDays: '24h ouvrées',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const subtotal = items.reduce((s, it) => s + it.unit_price_mad * it.quantity, 0);
  const netSubtotal = Math.max(0, subtotal - discountMad);

  useEffect(() => {
    fetch('/api/shipping/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, subtotal_mad: netSubtotal }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.feeMad === 'number') setShippingInfo(data);
      })
      .catch(() => {});
  }, [city, netSubtotal]);

  const handleApplyCoupon = async () => {
    setCouponMessage('');
    if (!couponInput.trim()) return;
    try {
      const res = await apiFetch<{ valid: boolean; discount_mad: number; message: string }>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput.trim(), subtotal_mad: subtotal }),
      });
      setDiscountMad(res.discount_mad);
      setAppliedCoupon(couponInput.trim().toUpperCase());
      setCouponMessage(res.message);
    } catch (err: unknown) {
      setDiscountMad(0);
      setAppliedCoupon('');
      setCouponMessage(err instanceof Error ? err.message : 'Code invalide.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ order: Order; items: Order['items'] }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          shipping_city: city,
          shipping_address: address,
          postal_code: postalCode,
          coupon_code: appliedCoupon,
          notes,
          items: items.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
        }),
      });
      setConfirmedOrder({ ...res.order, items: res.items });
      onOrderSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white border border-[#E6DFD5] p-8 lg:p-12">
          <div className="flex items-start justify-between gap-4 border-b border-[#E6DFD5] pb-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#166534]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Commande enregistrée</span>
              </div>
              <h1 className="mt-2 font-display text-3xl text-[#111111]">
                Merci {confirmedOrder.customer_name}
              </h1>
              <p className="mt-1 text-sm text-[#5A554E]">
                Référence : <span className="font-mono font-semibold text-[#111111]">{confirmedOrder.order_number}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-2 px-4 py-2 border border-[#D8CFC2] text-xs font-medium text-[#111111] hover:border-[#111111] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer le reçu</span>
            </button>
          </div>

          <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-[#E6DFD5]">
            <div>
              <p className="font-semibold text-[#111111] uppercase tracking-wider mb-1">Livraison</p>
              <p className="text-[#5A554E]">{confirmedOrder.shipping_address}</p>
              <p className="text-[#5A554E]">{confirmedOrder.shipping_city} {confirmedOrder.postal_code}</p>
              <p className="text-[#5A554E] mt-1">{confirmedOrder.customer_phone}</p>
            </div>
            <div>
              <p className="font-semibold text-[#111111] uppercase tracking-wider mb-1">Mode de règlement</p>
              <p className="text-[#111111]">Paiement à la livraison (Cash on Delivery)</p>
              <p className="text-[#5A554E] mt-1">Statut : {confirmedOrder.status}</p>
            </div>
          </div>

          <div className="py-6 space-y-3 border-b border-[#E6DFD5]">
            {confirmedOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-[#111111]">{item.product_name}</span>
                  <span className="text-xs text-[#5A554E] ml-2">
                    ({item.size} · {item.color_name}) × {item.quantity}
                  </span>
                </div>
                <span className="tabular-nums font-medium">{formatMad(item.line_total_mad)}</span>
              </div>
            ))}
          </div>

          <div className="pt-6 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between text-[#5A554E]">
              <span>Sous-total</span>
              <span>{formatMad(confirmedOrder.subtotal_mad)}</span>
            </div>
            {confirmedOrder.discount_mad > 0 && (
              <div className="flex justify-between text-[#166534]">
                <span>Réduction ({confirmedOrder.coupon_code})</span>
                <span>-{formatMad(confirmedOrder.discount_mad)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#5A554E]">
              <span>Livraison</span>
              <span>{confirmedOrder.shipping_fee_mad === 0 ? 'Offerte' : formatMad(confirmedOrder.shipping_fee_mad)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-[#111111] pt-2 border-t border-[#E6DFD5]">
              <span>Total à payer à la livraison</span>
              <span>{formatMad(confirmedOrder.total_mad)}</span>
            </div>
          </div>

          <div className="no-print mt-8">
            <button
              type="button"
              onClick={onBackToShop}
              className="px-6 py-3 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase cursor-pointer"
            >
              Retour à la boutique
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-[#111111]">Votre panier est vide</h1>
        <p className="mt-2 text-sm text-[#5A554E]">Ajoutez des pièces depuis notre catalogue avant de finaliser votre commande.</p>
        <button
          type="button"
          onClick={onBackToShop}
          className="mt-6 px-6 py-3 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase cursor-pointer"
        >
          Découvrir le catalogue
        </button>
      </main>
    );
  }

  const totalMad = Math.max(0, netSubtotal + shippingInfo.feeMad);

  return (
    <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-10 lg:py-16">
      <h1 className="font-display text-3xl lg:text-4xl font-medium text-[#111111] pb-6 border-b border-[#E6DFD5]">
        Finalisation de la commande
      </h1>

      <form onSubmit={handleSubmit} className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Shipping & Payment Form */}
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-white border border-[#E6DFD5] p-6 lg:p-8 space-y-5">
            <h2 className="font-display text-2xl text-[#111111]">1. Coordonnées & Livraison</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex : Salma Bennani"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+212 6XX XX XX XX"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Adresse e-mail *</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="client@exemple.ma"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Ville *</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                >
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Adresse complète *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Numéro, rue, quartier, étage..."
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">Code postal</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="20050"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1.5">Instructions au livreur (optionnel)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Créneau horaire souhaité, point de repère..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </section>

          <section className="bg-white border border-[#E6DFD5] p-6 lg:p-8 space-y-4">
            <h2 className="font-display text-2xl text-[#111111]">2. Mode de paiement</h2>
            <div className="border border-[#111111] bg-[#FAF8F5] p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#9A7D43] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#111111]">Paiement à la livraison (Cash on Delivery)</p>
                <p className="mt-1 text-xs text-[#5A554E] leading-relaxed">
                  Réglez le montant exact en espèces directement au coursier lors de la remise de votre commande. Aucune donnée bancaire n’est requise en ligne.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-5 bg-white border border-[#E6DFD5] p-6 lg:p-8 space-y-6">
          <h2 className="font-display text-2xl text-[#111111]">Récapitulatif</h2>

          <ul className="divide-y divide-[#E6DFD5]">
            {items.map((item) => (
              <li key={item.variant_id} className="py-3 flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-[#111111]">{item.name}</p>
                  <p className="text-xs text-[#5A554E]">
                    {item.size} · {item.color_name} × {item.quantity}
                  </p>
                </div>
                <span className="tabular-nums font-medium shrink-0">
                  {formatMad(item.unit_price_mad * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Coupon Input */}
          <div className="pt-4 border-t border-[#E6DFD5]">
            <label className="block text-xs font-medium text-[#111111] mb-2">Code promotionnel</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-[#5A554E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Ex : CASA15"
                  className="w-full pl-9 pr-3 py-2 text-xs uppercase border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCoupon}
                className="px-4 py-2 text-xs font-medium border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Appliquer
              </button>
            </div>
            {couponMessage && (
              <p className={`mt-2 text-xs ${discountMad > 0 ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                {couponMessage}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-[#E6DFD5] space-y-2 text-sm tabular-nums">
            <div className="flex justify-between text-[#5A554E]">
              <span>Sous-total</span>
              <span>{formatMad(subtotal)}</span>
            </div>
            {discountMad > 0 && (
              <div className="flex justify-between text-[#166534]">
                <span>Remise ({appliedCoupon})</span>
                <span>-{formatMad(discountMad)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#5A554E]">
              <span>Livraison ({shippingInfo.zoneName} · {shippingInfo.estimatedDays})</span>
              <span>{shippingInfo.feeMad === 0 ? 'Offerte' : formatMad(shippingInfo.feeMad)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-[#111111] pt-3 border-t border-[#E6DFD5]">
              <span>Total à payer</span>
              <span>{formatMad(totalMad)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? 'Validation en cours...' : `Confirmer la commande · ${formatMad(totalMad)}`}
          </button>
        </aside>
      </form>
    </main>
  );
}
