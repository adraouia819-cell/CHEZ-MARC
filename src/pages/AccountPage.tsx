import { useEffect, useState, type FormEvent } from 'react';
import { LogOut, Package, Search, UserCheck } from 'lucide-react';
import { apiFetch, clearStoredTokens, formatMad, saveStoredTokens } from '../lib/api.ts';
import type { AuthUser, Order } from '../types/index.ts';

interface AccountPageProps {
  currentUser: AuthUser | null;
  onAuthChange: (user: AuthUser | null) => void;
}

export function AccountPage({ currentUser, onAuthChange }: AccountPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Guest Order Tracker
  const [trackNumber, setTrackNumber] = useState('');
  const [trackContact, setTrackContact] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackError, setTrackError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setLoadingOrders(true);
      apiFetch<{ orders: Order[] }>('/api/auth/customer/orders')
        .then((res) => setOrders(res.orders || []))
        .catch(() => setOrders([]))
        .finally(() => setLoadingOrders(false));
    }
  }, [currentUser]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>(
          '/api/auth/customer/login',
          { method: 'POST', body: JSON.stringify({ email, password }) },
          false
        );
        saveStoredTokens(res.accessToken, res.refreshToken);
        onAuthChange(res.user);
      } else {
        const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>(
          '/api/auth/customer/register',
          { method: 'POST', body: JSON.stringify({ full_name: fullName, email, phone, password }) },
          false
        );
        saveStoredTokens(res.accessToken, res.refreshToken);
        onAuthChange(res.user);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Erreur d’authentification.');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearStoredTokens();
    onAuthChange(null);
    setOrders([]);
  };

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    setTrackError('');
    setTrackedOrder(null);
    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(trackNumber)}&contact=${encodeURIComponent(trackContact)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commande introuvable.');
      setTrackedOrder({ ...data.order, items: data.items });
    } catch (err: unknown) {
      setTrackError(err instanceof Error ? err.message : 'Recherche impossible.');
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="pb-8 border-b border-[#E6DFD5]">
        <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Espace Client</p>
        <h1 className="mt-2 font-display text-3xl lg:text-5xl font-medium text-[#111111]">
          Votre Compte & Suivi
        </h1>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Client Auth or Authenticated Order History */}
        <section className="lg:col-span-7 bg-white border border-[#E6DFD5] p-6 lg:p-8">
          {currentUser ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E6DFD5]">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-[#9A7D43]" />
                  <div>
                    <h2 className="font-display text-2xl text-[#111111]">{currentUser.fullName}</h2>
                    <p className="text-xs text-[#5A554E]">{currentUser.email} · {currentUser.phone}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[#D8CFC2] text-[#111111] hover:border-[#111111] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>

              <h3 className="mt-6 text-sm font-semibold text-[#111111] uppercase tracking-wider">
                Historique de vos commandes
              </h3>

              {loadingOrders ? (
                <p className="mt-4 text-sm text-[#5A554E]">Chargement de vos commandes...</p>
              ) : orders.length === 0 ? (
                <p className="mt-4 text-sm text-[#5A554E]">Aucune commande passée avec ce compte pour le moment.</p>
              ) : (
                <div className="mt-4 divide-y divide-[#E6DFD5]">
                  {orders.map((order) => (
                    <div key={order.id} className="py-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-sm font-semibold text-[#111111]">{order.order_number}</span>
                          <span className="text-xs text-[#5A554E] ml-3">{order.created_at.slice(0, 10)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="font-medium text-[#9A7D43]">{order.status}</span>
                          <span className="font-semibold text-[#111111] tabular-nums">{formatMad(order.total_mad)}</span>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-[#5A554E]">
                        {order.items.map((it) => (
                          <li key={it.id}>
                            {it.product_name} ({it.size} · {it.color_name}) × {it.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1 p-1 bg-[#F2ECE3] border border-[#E6DFD5] w-fit mb-6">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setAuthError(''); }}
                  className={`px-4 py-2 text-xs font-medium cursor-pointer ${
                    mode === 'login' ? 'bg-[#111111] text-[#FAF8F5]' : 'text-[#5A554E]'
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setAuthError(''); }}
                  className={`px-4 py-2 text-xs font-medium cursor-pointer ${
                    mode === 'register' ? 'bg-[#111111] text-[#FAF8F5]' : 'text-[#5A554E]'
                  }`}
                >
                  Créer un compte
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#111111] mb-1.5">Nom complet</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#111111] mb-1.5">Téléphone</label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+212 6XX XX XX XX"
                        className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">Adresse e-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111111] mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
                  />
                </div>

                {authError && (
                  <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] p-3">{authError}</p>
                )}

                <button
                  type="submit"
                  disabled={loadingAuth}
                  className="px-7 py-3 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] cursor-pointer"
                >
                  {loadingAuth ? 'Traitement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Right: Guest Order Status Tracking */}
        <aside className="lg:col-span-5 bg-white border border-[#E6DFD5] p-6 lg:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-[#9A7D43]" />
            <h2 className="font-display text-2xl text-[#111111]">Suivre une commande</h2>
          </div>
          <p className="text-xs text-[#5A554E] leading-relaxed">
            Consultez l’état d’avancement de votre livraison en saisissant votre numéro de commande et l’e-mail ou téléphone utilisé.
          </p>

          <form onSubmit={handleTrack} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1">Numéro de commande</label>
              <input
                type="text"
                required
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                placeholder="Ex : CS-2026-1005"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1">Téléphone ou E-mail</label>
              <input
                type="text"
                required
                value={trackContact}
                onChange={(e) => setTrackContact(e.target.value)}
                placeholder="+212 661... ou client@..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:outline-none focus:border-[#111111]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors text-xs font-medium tracking-wider uppercase inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Rechercher</span>
            </button>
          </form>

          {trackError && <p className="text-xs text-[#991B1B]">{trackError}</p>}

          {trackedOrder && (
            <div className="pt-4 border-t border-[#E6DFD5] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-mono font-semibold text-[#111111]">{trackedOrder.order_number}</span>
                <span className="font-semibold text-[#9A7D43]">{trackedOrder.status}</span>
              </div>
              <p className="text-[#5A554E]">
                Destinataire : {trackedOrder.customer_name} · {trackedOrder.shipping_city}
              </p>
              <p className="font-semibold text-[#111111] tabular-nums">
                Montant total : {formatMad(trackedOrder.total_mad)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
