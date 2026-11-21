import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Lock,
  LogOut,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-react';
import { AdminCharts } from '../components/admin/AdminCharts.tsx';
import { AdminOrdersTab } from '../components/admin/AdminOrdersTab.tsx';
import { AdminProductsTab } from '../components/admin/AdminProductsTab.tsx';
import { apiFetch, clearStoredTokens, formatMad, saveStoredTokens } from '../lib/api.ts';
import type { AuthUser, Category, Order, Product, ShippingZone, StoreSettings } from '../types/index.ts';

interface AdminPageProps {
  currentUser: AuthUser | null;
  onAuthChange: (user: AuthUser | null) => void;
  onStoreUpdated: () => void;
  onBackToStore: () => void;
}

type AdminTab = 'dashboard' | 'products' | 'orders' | 'customers' | 'promotions' | 'shipping' | 'settings';

interface DashboardResponse {
  kpis: {
    totalRevenueMad: number;
    totalOrders: number;
    totalCustomers: number;
    totalProducts: number;
    availableProducts: number;
    outOfStockProducts: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
  };
  charts: {
    dailySales: Array<{ day: string; orders_count: number; revenue_mad: number }>;
    monthlySales: Array<{ month: string; orders_count: number; revenue_mad: number }>;
    topProducts: Array<{ product_name: string; sku: string; units_sold: number; revenue_mad: number }>;
    ordersByStatus: Array<{ status: string; count: number; revenue_mad: number }>;
  };
  recentOrders: Array<{
    id: number;
    order_number: string;
    customer_name: string;
    shipping_city: string;
    total_mad: number;
    status: string;
    created_at: string;
  }>;
}

interface CustomerRow {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  orders_count: number;
  total_spent_mad: number;
  last_order_at: string | null;
}

interface PromotionRow {
  id: number;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: number;
  product_ids_json: string;
}

interface CouponRow {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_mad: number;
  max_uses: number;
  uses_count: number;
  start_date: string;
  end_date: string;
  is_active: number;
}

interface AuditLogRow {
  id: number;
  actor_username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: string;
  ip_address: string;
  created_at: string;
}

export function AdminPage({ currentUser, onAuthChange, onStoreUpdated, onBackToStore }: AdminPageProps) {
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ customer: CustomerRow; orders: Order[] } | null>(null);

  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  // Password Change State
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwFeedback, setPwFeedback] = useState('');

  // Settings Save Feedback
  const [settingsFeedback, setSettingsFeedback] = useState('');

  // New Promotion / Coupon Forms
  const [promoName, setPromoName] = useState('');
  const [promoType, setPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [promoValue, setPromoValue] = useState('10');
  const [promoStart, setPromoStart] = useState('2026-01-01');
  const [promoEnd, setPromoEnd] = useState('2027-12-31');

  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponValue, setCouponValue] = useState('15');
  const [couponMinOrder, setCouponMinOrder] = useState('500');
  const [couponMaxUses, setCouponMaxUses] = useState('100');

  const loadAllAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [dashRes, prodRes, ordRes, custRes, promoRes, shipRes, setRes] = await Promise.all([
        apiFetch<DashboardResponse>('/api/admin/dashboard'),
        apiFetch<{ products: Product[]; categories: Category[] }>('/api/admin/products'),
        apiFetch<{ orders: Order[]; statuses: string[] }>('/api/admin/orders'),
        apiFetch<{ customers: CustomerRow[] }>('/api/admin/customers'),
        apiFetch<{ promotions: PromotionRow[]; coupons: CouponRow[] }>('/api/admin/promotions'),
        apiFetch<{ zones: ShippingZone[] }>('/api/admin/shipping'),
        apiFetch<{ settings: StoreSettings; auditLogs: AuditLogRow[] }>('/api/admin/settings'),
      ]);
      setDashboard(dashRes);
      setProducts(prodRes.products);
      setCategories(prodRes.categories);
      setOrders(ordRes.orders);
      setOrderStatuses(ordRes.statuses);
      setCustomers(custRes.customers);
      setPromotions(promoRes.promotions);
      setCoupons(promoRes.coupons);
      setShippingZones(shipRes.zones);
      setStoreSettings(setRes.settings);
      setAuditLogs(setRes.auditLogs);
    } catch (err) {
      console.error('Admin data load error:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        '/api/auth/admin/login',
        { method: 'POST', body: JSON.stringify({ username, password }) },
        false
      );
      saveStoredTokens(res.accessToken, res.refreshToken);
      onAuthChange(res.user);
      setPassword('');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Échec de connexion.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearStoredTokens();
    onAuthChange(null);
  };

  const handleSearchOrders = async (q: string, status: string) => {
    const res = await apiFetch<{ orders: Order[] }>(
      `/api/admin/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`
    );
    setOrders(res.orders);
  };

  const handleSearchCustomers = async (q: string) => {
    setCustomerSearch(q);
    const res = await apiFetch<{ customers: CustomerRow[] }>(`/api/admin/customers?q=${encodeURIComponent(q)}`);
    setCustomers(res.customers);
  };

  const openCustomerHistory = async (custId: number) => {
    const res = await apiFetch<{ customer: CustomerRow; orders: Order[] }>(`/api/admin/customers/${custId}`);
    setSelectedCustomer(res);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwFeedback('');
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      setPwFeedback(res.message);
      setCurPw('');
      setNewPw('');
      if (currentUser) {
        onAuthChange({ ...currentUser, mustChangePassword: false });
      }
    } catch (err: unknown) {
      setPwFeedback(err instanceof Error ? err.message : 'Modification impossible.');
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!storeSettings) return;
    setSettingsFeedback('');
    try {
      const res = await apiFetch<{ settings: StoreSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(storeSettings),
      });
      setStoreSettings(res.settings);
      setSettingsFeedback('Paramètres enregistrés en base de données.');
      onStoreUpdated();
    } catch (err: unknown) {
      setSettingsFeedback(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    }
  };

  const handleDownloadBackup = async () => {
    const token = sessionStorage.getItem('cs_access_token');
    const res = await fetch('/api/admin/backup', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casastyle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Protected Admin Login Gate (No hardcoded credentials shown!)
  if (!isAdmin) {
    return (
      <main className="min-h-[82vh] flex items-center justify-center px-6 py-16 bg-[#FAF8F5]">
        <div className="w-full max-w-md bg-white border border-[#E6DFD5] p-8 lg:p-10">
          <div className="flex items-center gap-2.5 text-xs tracking-[0.15em] text-[#9A7D43] uppercase">
            <Lock className="w-3.5 h-3.5" />
            <span>Administration Sécurisée</span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-[#111111]">CASA STYLE Console</h1>
          <p className="mt-2 text-xs text-[#5A554E] leading-relaxed">
            Accès restreint au personnel autorisé. Les tentatives de connexion sont protégées et journalisées.
          </p>

          <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1.5">Nom d’utilisateur</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D8CFC2] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] cursor-pointer"
            >
              {loggingIn ? 'Vérification...' : 'Accéder au panneau'}
            </button>
          </form>

          <button
            type="button"
            onClick={onBackToStore}
            className="mt-6 block text-xs text-[#5A554E] hover:text-[#111111] underline underline-offset-4 cursor-pointer"
          >
            Retourner à la boutique publique
          </button>
        </div>
      </main>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'products', label: 'Produits & Stocks', icon: Package },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag },
    { id: 'customers', label: 'Clients', icon: Users },
    { id: 'promotions', label: 'Promotions & Codes', icon: Percent },
    { id: 'shipping', label: 'Livraisons', icon: Truck },
    { id: 'settings', label: 'Paramètres & Sécurité', icon: Settings },
  ];

  const activeLabel = navItems.find((n) => n.id === tab)?.label || 'Tableau de bord';

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="no-print w-full lg:w-64 bg-[#111111] text-[#FAF8F5] flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-white/10">
          <p className="font-display text-2xl tracking-wide text-[#FAF8F5]">CASA STYLE</p>
          <p className="text-[11px] text-[#B89B5E] mt-0.5">Administration Boutique</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-x-auto flex lg:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'bg-white/10 text-[#FAF8F5]' : 'text-white/65 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 text-[#B89B5E]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 text-xs">
          <button
            type="button"
            onClick={onBackToStore}
            className="w-full py-2 px-3 text-left text-white/75 hover:text-white cursor-pointer"
          >
            Voir la boutique publique
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 flex items-center gap-2 text-white/75 hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion sécurisée</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Breadcrumb Bar */}
        <header className="no-print bg-white border-b border-[#E6DFD5] px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-[#5A554E]">
            <span>Administration</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-[#111111]">{activeLabel}</span>
          </div>
          <div className="text-xs text-[#5A554E]">
            Connecté : <strong className="text-[#111111]">{currentUser.username}</strong>
          </div>
        </header>

        {/* Mandatory Initial Password Replacement Notice */}
        {currentUser.mustChangePassword && (
          <div className="no-print bg-[#FEF3C7] border-b border-[#F59E0B] px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#92400E]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Sécurité : vous utilisez le mot de passe initial de développement. Remplacez-le impérativement avant toute mise en production.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className="px-3 py-1 bg-[#92400E] text-white font-medium cursor-pointer"
            >
              Changer le mot de passe
            </button>
          </div>
        )}

        <div className="p-6 lg:p-8 space-y-8 flex-1">
          {/* TAB 1: DASHBOARD */}
          {tab === 'dashboard' && dashboard && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 tabular-nums">
                {[
                  { label: 'Chiffre d’affaires total', value: formatMad(dashboard.kpis.totalRevenueMad) },
                  { label: 'Commandes totales', value: String(dashboard.kpis.totalOrders) },
                  { label: 'Clients enregistrés', value: String(dashboard.kpis.totalCustomers) },
                  { label: 'Produits disponibles', value: `${dashboard.kpis.availableProducts} / ${dashboard.kpis.totalProducts}` },
                  { label: 'En rupture de stock', value: String(dashboard.kpis.outOfStockProducts) },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white border border-[#E6DFD5] p-5">
                    <p className="text-xs text-[#5A554E]">{kpi.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[#111111]">{kpi.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
                <div className="bg-white border border-[#E6DFD5] p-5 flex items-center justify-between">
                  <span className="text-xs text-[#5A554E]">Commandes en attente / prép.</span>
                  <span className="text-xl font-semibold text-[#9A7D43]">{dashboard.kpis.pendingOrders}</span>
                </div>
                <div className="bg-white border border-[#E6DFD5] p-5 flex items-center justify-between">
                  <span className="text-xs text-[#5A554E]">Commandes expédiées</span>
                  <span className="text-xl font-semibold text-[#111111]">{dashboard.kpis.shippedOrders}</span>
                </div>
                <div className="bg-white border border-[#E6DFD5] p-5 flex items-center justify-between">
                  <span className="text-xs text-[#5A554E]">Commandes livrées</span>
                  <span className="text-xl font-semibold text-[#166534]">{dashboard.kpis.deliveredOrders}</span>
                </div>
              </div>

              <AdminCharts
                dailySales={dashboard.charts.dailySales}
                monthlySales={dashboard.charts.monthlySales}
                topProducts={dashboard.charts.topProducts}
                ordersByStatus={dashboard.charts.ordersByStatus}
              />

              <div className="bg-white border border-[#E6DFD5] p-6">
                <h3 className="text-sm font-semibold text-[#111111] mb-4">Dernières commandes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E6DFD5] text-[#5A554E] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Numéro</th>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3">Ville</th>
                        <th className="py-2.5 px-3">Statut</th>
                        <th className="py-2.5 px-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6DFD5] tabular-nums">
                      {dashboard.recentOrders.map((ro) => (
                        <tr key={ro.id}>
                          <td className="py-2.5 px-3 font-mono font-medium">{ro.order_number}</td>
                          <td className="py-2.5 px-3">{ro.customer_name}</td>
                          <td className="py-2.5 px-3 text-[#5A554E]">{ro.shipping_city}</td>
                          <td className="py-2.5 px-3">{ro.status}</td>
                          <td className="py-2.5 px-3 text-right font-medium">{formatMad(ro.total_mad)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {tab === 'products' && (
            <AdminProductsTab
              products={products}
              categories={categories}
              onRefresh={() => {
                loadAllAdminData();
                onStoreUpdated();
              }}
            />
          )}

          {/* TAB 3: ORDERS */}
          {tab === 'orders' && (
            <AdminOrdersTab
              orders={orders}
              statuses={orderStatuses}
              storeSettings={storeSettings}
              onSearchChange={handleSearchOrders}
              onRefresh={loadAllAdminData}
            />
          )}

          {/* TAB 4: CUSTOMERS */}
          {tab === 'customers' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-[#111111]">Base Clients</h2>
                  <p className="text-xs text-[#5A554E] mt-0.5">Données protégées — accès réservé aux administrateurs autorisés.</p>
                </div>
                <input
                  type="search"
                  value={customerSearch}
                  onChange={(e) => handleSearchCustomers(e.target.value)}
                  placeholder="Rechercher nom, téléphone, ville..."
                  className="px-3.5 py-2 text-xs border border-[#D8CFC2] bg-white w-64"
                />
              </div>

              <div className="bg-white border border-[#E6DFD5] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E6DFD5] bg-[#F2ECE3]/60 text-[#5A554E] uppercase">
                    <tr>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Ville</th>
                      <th className="py-3 px-4 text-right">Commandes</th>
                      <th className="py-3 px-4 text-right">Total dépensé</th>
                      <th className="py-3 px-4 text-right">Historique</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DFD5] tabular-nums">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-3 px-4 font-semibold text-[#111111]">{c.full_name}</td>
                        <td className="py-3 px-4 text-[#5A554E]">
                          <div>{c.email}</div>
                          <div>{c.phone}</div>
                        </td>
                        <td className="py-3 px-4 text-[#5A554E]">{c.city}</td>
                        <td className="py-3 px-4 text-right">{c.orders_count}</td>
                        <td className="py-3 px-4 text-right font-semibold">{formatMad(c.total_spent_mad)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openCustomerHistory(c.id)}
                            className="px-3 py-1 border border-[#D8CFC2] hover:border-[#111111] cursor-pointer"
                          >
                            Historique
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedCustomer && (
                <div className="bg-white border border-[#111111] p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-3">
                    <div>
                      <h3 className="font-display text-xl">{selectedCustomer.customer.full_name}</h3>
                      <p className="text-xs text-[#5A554E]">
                        {selectedCustomer.customer.address} · {selectedCustomer.customer.city} · {selectedCustomer.customer.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs underline cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                  {selectedCustomer.orders.length === 0 ? (
                    <p className="text-xs text-[#5A554E]">Aucune commande pour ce client.</p>
                  ) : (
                    <div className="space-y-2 text-xs tabular-nums">
                      {selectedCustomer.orders.map((o) => (
                        <div key={o.id} className="flex justify-between py-2 border-b border-[#F2ECE3]">
                          <span className="font-mono font-medium">{o.order_number}</span>
                          <span>{o.created_at.slice(0, 10)}</span>
                          <span>{o.status}</span>
                          <span className="font-semibold">{formatMad(o.total_mad)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROMOTIONS & COUPONS */}
          {tab === 'promotions' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-[#E6DFD5] p-6 space-y-5">
                <h2 className="font-display text-2xl text-[#111111]">Campagnes Promotionnelles</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await apiFetch('/api/admin/promotions', {
                      method: 'POST',
                      body: JSON.stringify({
                        name: promoName,
                        discount_type: promoType,
                        discount_value: Number(promoValue),
                        start_date: promoStart,
                        end_date: promoEnd,
                      }),
                    });
                    setPromoName('');
                    loadAllAdminData();
                  }}
                  className="grid grid-cols-2 gap-3 text-xs border-b border-[#E6DFD5] pb-5"
                >
                  <input
                    type="text"
                    required
                    placeholder="Nom de la promotion"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    className="col-span-2 px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <select
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value as 'percentage' | 'fixed')}
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (MAD)</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    required
                    value={promoValue}
                    onChange={(e) => setPromoValue(e.target.value)}
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <input
                    type="date"
                    value={promoStart}
                    onChange={(e) => setPromoStart(e.target.value)}
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <input
                    type="date"
                    value={promoEnd}
                    onChange={(e) => setPromoEnd(e.target.value)}
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <button type="submit" className="col-span-2 py-2.5 bg-[#111111] text-white uppercase tracking-wider cursor-pointer">
                    Créer la promotion
                  </button>
                </form>

                <div className="space-y-2 text-xs">
                  {promotions.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between py-2 border-b border-[#F2ECE3]">
                      <div>
                        <p className="font-semibold text-[#111111]">{pr.name}</p>
                        <p className="text-[#5A554E]">
                          -{pr.discount_value} {pr.discount_type === 'percentage' ? '%' : 'MAD'} · {pr.start_date} au {pr.end_date}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/promotions/${pr.id}/toggle`, { method: 'PATCH' });
                          loadAllAdminData();
                        }}
                        className={`px-3 py-1 border cursor-pointer ${
                          pr.is_active ? 'bg-[#DCFCE7] border-[#166534]/30 text-[#166534]' : 'bg-[#F2ECE3] text-[#5A554E]'
                        }`}
                      >
                        {pr.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E6DFD5] p-6 space-y-5">
                <h2 className="font-display text-2xl text-[#111111]">Codes Promotionnels</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await apiFetch('/api/admin/coupons', {
                      method: 'POST',
                      body: JSON.stringify({
                        code: couponCode,
                        discount_type: couponType,
                        discount_value: Number(couponValue),
                        min_order_mad: Number(couponMinOrder),
                        max_uses: Number(couponMaxUses),
                        start_date: promoStart,
                        end_date: promoEnd,
                      }),
                    });
                    setCouponCode('');
                    loadAllAdminData();
                  }}
                  className="grid grid-cols-2 gap-3 text-xs border-b border-[#E6DFD5] pb-5"
                >
                  <input
                    type="text"
                    required
                    placeholder="CODE (ex: VIP20)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="col-span-2 px-3 py-2 font-mono uppercase border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as 'percentage' | 'fixed')}
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Fixe (MAD)</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    placeholder="Valeur"
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={couponMinOrder}
                    onChange={(e) => setCouponMinOrder(e.target.value)}
                    placeholder="Min. commande MAD"
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(e.target.value)}
                    placeholder="Max utilisations"
                    className="px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <button type="submit" className="col-span-2 py-2.5 bg-[#111111] text-white uppercase tracking-wider cursor-pointer">
                    Créer le code promo
                  </button>
                </form>

                <div className="space-y-2 text-xs tabular-nums">
                  {coupons.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between py-2 border-b border-[#F2ECE3]">
                      <div>
                        <p className="font-mono font-semibold text-[#111111]">{cp.code}</p>
                        <p className="text-[#5A554E]">
                          -{cp.discount_value} {cp.discount_type === 'percentage' ? '%' : 'MAD'} · Utilisé {cp.uses_count}/{cp.max_uses}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/coupons/${cp.id}/toggle`, { method: 'PATCH' });
                          loadAllAdminData();
                        }}
                        className={`px-3 py-1 border cursor-pointer ${
                          cp.is_active ? 'bg-[#DCFCE7] border-[#166534]/30 text-[#166534]' : 'bg-[#F2ECE3] text-[#5A554E]'
                        }`}
                      >
                        {cp.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHIPPING */}
          {tab === 'shipping' && (
            <div className="bg-white border border-[#E6DFD5] p-6 space-y-6">
              <div>
                <h2 className="font-display text-2xl text-[#111111]">Zones & Tarifs de Livraison (Maroc)</h2>
                <p className="text-xs text-[#5A554E] mt-0.5">Modifiez les frais selon la destination et le seuil de gratuité.</p>
              </div>
              <div className="space-y-4">
                {shippingZones.map((zone) => (
                  <div key={zone.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 border border-[#E6DFD5] bg-[#FAF8F5] text-xs">
                    <div className="md:col-span-2">
                      <label className="block font-semibold text-[#111111] mb-1">{zone.zone_name}</label>
                      <p className="text-[#5A554E] truncate">Villes : {zone.city_pattern}</p>
                    </div>
                    <div>
                      <label className="block text-[#5A554E] mb-1">Frais (MAD)</label>
                      <input
                        type="number"
                        value={zone.fee_mad}
                        onChange={(e) => {
                          setShippingZones(
                            shippingZones.map((z) => (z.id === zone.id ? { ...z, fee_mad: Number(e.target.value) } : z))
                          );
                        }}
                        className="w-full px-2.5 py-2 border border-[#D8CFC2] bg-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A554E] mb-1">Gratuit dès (MAD)</label>
                      <input
                        type="number"
                        value={zone.free_above_mad}
                        onChange={(e) => {
                          setShippingZones(
                            shippingZones.map((z) =>
                              z.id === zone.id ? { ...z, free_above_mad: Number(e.target.value) } : z
                            )
                          );
                        }}
                        className="w-full px-2.5 py-2 border border-[#D8CFC2] bg-white tabular-nums"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/shipping/${zone.id}`, {
                          method: 'PUT',
                          body: JSON.stringify(zone),
                        });
                        onStoreUpdated();
                        loadAllAdminData();
                      }}
                      className="py-2 px-4 bg-[#111111] text-white font-medium uppercase tracking-wider cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS, SECURITY, AUDIT LOGS & BACKUP */}
          {tab === 'settings' && storeSettings && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Store Settings Form */}
                <form onSubmit={handleSaveSettings} className="lg:col-span-7 bg-white border border-[#E6DFD5] p-6 space-y-4 text-xs">
                  <h2 className="font-display text-2xl text-[#111111]">Paramètres de la Boutique</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Nom commercial</label>
                      <input
                        type="text"
                        value={storeSettings.store_name}
                        onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Logo (texte éditorial)</label>
                      <input
                        type="text"
                        value={storeSettings.logo_text}
                        onChange={(e) => setStoreSettings({ ...storeSettings, logo_text: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">Slogan</label>
                      <input
                        type="text"
                        value={storeSettings.slogan}
                        onChange={(e) => setStoreSettings({ ...storeSettings, slogan: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">Adresse</label>
                      <input
                        type="text"
                        value={storeSettings.address}
                        onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Téléphone</label>
                      <input
                        type="text"
                        value={storeSettings.phone}
                        onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">WhatsApp</label>
                      <input
                        type="text"
                        value={storeSettings.whatsapp}
                        onChange={(e) => setStoreSettings({ ...storeSettings, whatsapp: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Instagram</label>
                      <input
                        type="text"
                        value={storeSettings.instagram}
                        onChange={(e) => setStoreSettings({ ...storeSettings, instagram: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">E-mail & Devise</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={storeSettings.email}
                          onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                          className="flex-1 px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                        />
                        <input
                          type="text"
                          value={storeSettings.currency}
                          onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                          className="w-20 px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">Politique de retour</label>
                      <textarea
                        rows={3}
                        value={storeSettings.return_policy_text}
                        onChange={(e) => setStoreSettings({ ...storeSettings, return_policy_text: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold mb-1">Conditions générales</label>
                      <textarea
                        rows={3}
                        value={storeSettings.terms_text}
                        onChange={(e) => setStoreSettings({ ...storeSettings, terms_text: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                  </div>

                  {settingsFeedback && <p className="text-[#166534] font-medium">{settingsFeedback}</p>}

                  <button type="submit" className="px-6 py-2.5 bg-[#111111] text-white uppercase tracking-wider cursor-pointer">
                    Sauvegarder les paramètres
                  </button>
                </form>

                {/* Security: Password Change + DB Backup */}
                <div className="lg:col-span-5 space-y-6">
                  <form onSubmit={handleChangePassword} className="bg-white border border-[#E6DFD5] p-6 space-y-4 text-xs">
                    <h3 className="font-display text-2xl text-[#111111]">Sécurité du compte Admin</h3>
                    <div>
                      <label className="block font-semibold mb-1">Mot de passe actuel</label>
                      <input
                        type="password"
                        required
                        value={curPw}
                        onChange={(e) => setCurPw(e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Nouveau mot de passe (8 caractères min.)</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                    </div>
                    {pwFeedback && <p className="text-[#111111] font-medium">{pwFeedback}</p>}
                    <button type="submit" className="px-5 py-2.5 bg-[#111111] text-white uppercase tracking-wider cursor-pointer">
                      Mettre à jour le mot de passe
                    </button>
                  </form>

                  <div className="bg-white border border-[#E6DFD5] p-6 space-y-3 text-xs">
                    <h3 className="font-display text-2xl text-[#111111]">Sauvegarde Base de Données</h3>
                    <p className="text-[#5A554E]">
                      Exportez une copie intégrale (produits, variantes, commandes, clients et paramètres) au format JSON horodaté.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger la sauvegarde</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Logs */}
              <div className="bg-white border border-[#E6DFD5] p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#111111]">Journal des opérations administratives</h3>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E6DFD5] text-[#5A554E] uppercase">
                      <tr>
                        <th className="py-2 px-3">Date UTC</th>
                        <th className="py-2 px-3">Acteur</th>
                        <th className="py-2 px-3">Action</th>
                        <th className="py-2 px-3">Entité</th>
                        <th className="py-2 px-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2ECE3] font-mono text-[11px]">
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2 px-3 text-[#5A554E]">{log.created_at}</td>
                          <td className="py-2 px-3 text-[#111111]">{log.actor_username}</td>
                          <td className="py-2 px-3 font-medium text-[#9A7D43]">{log.action}</td>
                          <td className="py-2 px-3 text-[#5A554E]">
                            {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                          </td>
                          <td className="py-2 px-3 text-[#5A554E]">{log.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
