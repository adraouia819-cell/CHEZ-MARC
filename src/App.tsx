import { useCallback, useEffect, useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { CartDrawer } from './components/CartDrawer.tsx';
import { TRANSLATIONS } from './i18n/translations.ts';
import { apiFetch, getStoredTokens } from './lib/api.ts';
import { AccountPage } from './pages/AccountPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ContactPage, PolicyPage } from './pages/InfoPages.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import type { AuthUser, CartItem, Category, Locale, Product, ShippingZone, StoreSettings } from './types/index.ts';

const CART_STORAGE_KEY = 'casa_style_cart_v1';

export default function App() {
  const [route, setRoute] = useState<string>(() => window.location.pathname + window.location.search);
  const [locale, setLocale] = useState<Locale>('fr');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const loadPublicStore = useCallback(async () => {
    try {
      const [infoRes, prodRes] = await Promise.all([
        fetch('/api/store-info').then((r) => r.json()),
        fetch('/api/products').then((r) => r.json()),
      ]);
      if (infoRes.settings) setStoreSettings(infoRes.settings);
      if (infoRes.shipping) setShippingZones(infoRes.shipping);
      if (infoRes.categories) setCategories(infoRes.categories);
      if (prodRes.products) setProducts(prodRes.products);
    } catch (err) {
      console.error('Failed to load storefront data:', err);
    }
  }, []);

  useEffect(() => {
    loadPublicStore();
    const { accessToken } = getStoredTokens();
    if (accessToken) {
      apiFetch<{ user: AuthUser }>('/api/auth/me')
        .then((res) => setCurrentUser(res.user))
        .catch(() => setCurrentUser(null));
    }
  }, [loadPublicStore]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextPath: string) => {
    if (nextPath !== route) {
      window.history.pushState({}, '', nextPath);
      setRoute(nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.variant_id === item.variant_id);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = Math.min(item.max_stock, next[idx].quantity + item.quantity);
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }
      return [...prev, item];
    });
    setCartOpen(true);
  };

  const updateCartQty = (variantId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variant_id !== variantId) return item;
          const nextQty = Math.min(item.max_stock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (variantId: number) => {
    setCart((prev) => prev.filter((item) => item.variant_id !== variantId));
  };

  const t = TRANSLATIONS[locale];
  const [pathname, searchStr = ''] = route.split('?');
  const searchParams = new URLSearchParams(searchStr);

  // Dedicated /admin layout
  if (pathname.startsWith('/admin')) {
    return (
      <AdminPage
        currentUser={currentUser}
        onAuthChange={setCurrentUser}
        onStoreUpdated={loadPublicStore}
        onBackToStore={() => navigate('/')}
      />
    );
  }

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const featuredProducts = products.filter((p) => p.is_featured);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#111111]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="no-print sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#E6DFD5]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="font-display text-2xl font-semibold tracking-[0.12em] text-[#111111] whitespace-nowrap shrink-0"
          >
            {storeSettings?.logo_text || 'CASA STYLE'}
          </a>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium tracking-wide text-[#5A554E]">
            <a
              href="/catalogue"
              onClick={(e) => {
                e.preventDefault();
                navigate('/catalogue');
              }}
              className="hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.shop}
            </a>
            <a
              href="/catalogue?gender=femme"
              onClick={(e) => {
                e.preventDefault();
                navigate('/catalogue?gender=femme');
              }}
              className="hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.women}
            </a>
            <a
              href="/catalogue?gender=homme"
              onClick={(e) => {
                e.preventDefault();
                navigate('/catalogue?gender=homme');
              }}
              className="hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.men}
            </a>
            <a
              href="/catalogue?gender=accessoires"
              onClick={(e) => {
                e.preventDefault();
                navigate('/catalogue?gender=accessoires');
              }}
              className="hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.accessories}
            </a>
            <a
              href="/compte"
              onClick={(e) => {
                e.preventDefault();
                navigate('/compte');
              }}
              className="hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.account}
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#B89B5E]" />
              <span className="tabular-nums">
                {t.nav.bag} ({totalCartItems})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 text-[#111111] cursor-pointer"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6DFD5] bg-[#FAF8F5] px-6 py-4 flex flex-col gap-3 text-sm">
            {[
              { label: t.nav.shop, path: '/catalogue' },
              { label: t.nav.women, path: '/catalogue?gender=femme' },
              { label: t.nav.men, path: '/catalogue?gender=homme' },
              { label: t.nav.accessories, path: '/catalogue?gender=accessoires' },
              { label: t.nav.account, path: '/compte' },
              { label: t.footer.deliveryReturns, path: '/livraison-retours' },
              { label: t.footer.contact, path: '/contact' },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="text-left py-1.5 text-[#111111] font-medium"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Page View */}
      <div className="flex-1">
        {pathname === '/' && (
          <HomePage
            featuredProducts={featuredProducts.length > 0 ? featuredProducts : products}
            storeSettings={storeSettings}
            onNavigate={navigate}
            labels={t.hero}
          />
        )}

        {pathname === '/catalogue' && (
          <CatalogPage
            key={searchParams.get('gender') || 'all'}
            products={products}
            categories={categories}
            initialGender={searchParams.get('gender') || ''}
            onSelectProduct={(slug) => navigate(`/produit/${slug}`)}
          />
        )}

        {pathname.startsWith('/produit/') && (
          <ProductDetailPage
            slug={pathname.replace('/produit/', '')}
            products={products}
            onBack={() => navigate('/catalogue')}
            onAddToCart={addToCart}
          />
        )}

        {pathname === '/commande' && (
          <CheckoutPage
            items={cart}
            currentUser={currentUser}
            onOrderSuccess={() => {
              setCart([]);
              loadPublicStore();
            }}
            onBackToShop={() => navigate('/catalogue')}
          />
        )}

        {pathname === '/compte' && (
          <AccountPage currentUser={currentUser} onAuthChange={setCurrentUser} />
        )}

        {pathname === '/contact' && <ContactPage settings={storeSettings} />}

        {pathname === '/livraison-retours' && (
          <PolicyPage settings={storeSettings} shippingZones={shippingZones} />
        )}
      </div>

      {/* Footer */}
      <footer className="no-print border-t border-[#E6DFD5] bg-[#111111] text-[#FAF8F5]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-4 gap-10 text-xs">
          <div className="md:col-span-2 space-y-3">
            <p className="font-display text-2xl tracking-[0.14em] text-[#FAF8F5]">
              {storeSettings?.store_name || 'CASA STYLE'}
            </p>
            <p className="text-[#D6C7B2]">{storeSettings?.slogan || 'Votre style, votre identité.'}</p>
            <p className="text-white/65 max-w-sm leading-relaxed">
              {storeSettings?.address} · {storeSettings?.phone} · {storeSettings?.email}
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#B89B5E] uppercase tracking-wider">Informations</p>
            <ul className="space-y-2 text-white/75">
              <li>
                <button type="button" onClick={() => navigate('/livraison-retours')} className="hover:text-white cursor-pointer">
                  {t.footer.deliveryReturns}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/contact')} className="hover:text-white cursor-pointer">
                  {t.footer.contact}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/compte')} className="hover:text-white cursor-pointer">
                  {t.footer.clientSpace}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/admin')} className="hover:text-white cursor-pointer">
                  {t.footer.admin}
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#B89B5E] uppercase tracking-wider">Langue & Paiement</p>
            <div className="flex items-center gap-2">
              {(['fr', 'en', 'ar'] as Locale[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`px-2.5 py-1 border text-[11px] uppercase cursor-pointer ${
                    locale === lang
                      ? 'border-[#B89B5E] text-[#FAF8F5] bg-white/10'
                      : 'border-white/20 text-white/60 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <p className="text-white/65">{t.footer.codNotice}</p>
            <p className="text-white/50">Instagram : {storeSettings?.instagram || '@casastyle.atelier'}</p>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 lg:px-10 py-4 text-center text-[11px] text-white/50">
          © {new Date().getFullYear()} {storeSettings?.store_name || 'CASA STYLE'} · Casablanca, Maroc
        </div>
      </footer>

      <CartDrawer
        isOpen={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onRemove={removeCartItem}
        onCheckout={() => {
          setCartOpen(false);
          navigate('/commande');
        }}
        labels={t.cart}
      />
    </div>
  );
}
