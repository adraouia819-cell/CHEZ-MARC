import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard.tsx';
import type { Category, Product } from '../types/index.ts';

interface CatalogPageProps {
  products: Product[];
  categories: Category[];
  initialGender?: string;
  onSelectProduct: (slug: string) => void;
}

export function CatalogPage({ products, categories, initialGender = '', onSelectProduct }: CatalogPageProps) {
  const [gender, setGender] = useState(initialGender);
  const [categorySlug, setCategorySlug] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [sortBy, setSortBy] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => set.add(v.size)));
    return Array.from(set);
  }, [products]);

  const allColors = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) =>
      p.variants.forEach((v) => {
        if (!map.has(v.color_name)) map.set(v.color_name, v.color_hex);
      })
    );
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (gender && p.gender !== gender) return false;
      if (categorySlug && p.category_slug !== categorySlug) return false;
      const effectivePrice = p.promo_price_mad ?? p.price_mad;
      if (effectivePrice > maxPrice) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedSize && !p.variants.some((v) => v.size === selectedSize && v.stock_qty > 0)) {
        return false;
      }
      if (selectedColor && !p.variants.some((v) => v.color_name === selectedColor && v.stock_qty > 0)) {
        return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => (a.promo_price_mad ?? a.price_mad) - (b.promo_price_mad ?? b.price_mad));
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => (b.promo_price_mad ?? b.price_mad) - (a.promo_price_mad ?? a.price_mad));
    } else {
      list = [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    }
    return list;
  }, [products, gender, categorySlug, search, selectedSize, selectedColor, maxPrice, sortBy]);

  const resetAll = () => {
    setGender('');
    setCategorySlug('');
    setSearch('');
    setSelectedSize('');
    setSelectedColor('');
    setMaxPrice(5000);
    setSortBy('featured');
  };

  return (
    <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-10 lg:py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#E6DFD5]">
        <div>
          <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Boutique Officielle</p>
          <h1 className="mt-2 font-display text-3xl lg:text-5xl font-medium text-[#111111]">
            Catalogue CASA STYLE
          </h1>
        </div>

        {/* Gender Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2ECE3] border border-[#E6DFD5]">
          {[
            { id: '', label: 'Tout' },
            { id: 'femme', label: 'Femme' },
            { id: 'homme', label: 'Homme' },
            { id: 'accessoires', label: 'Accessoires' },
          ].map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              onClick={() => {
                setGender(tab.id);
                setCategorySlug('');
              }}
              className={`px-4 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                gender === tab.id
                  ? 'bg-[#111111] text-[#FAF8F5]'
                  : 'text-[#5A554E] hover:text-[#111111]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: Search, Filter Toggle, Sort */}
      <div className="py-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-[#E6DFD5]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#5A554E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une pièce, matière ou SKU..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#D8CFC2] text-[#111111] placeholder:text-[#5A554E]/70 focus:outline-none focus:border-[#111111]"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border border-[#D8CFC2] bg-white text-[#111111] hover:border-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtres</span>
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Trier les produits"
            className="px-4 py-2.5 text-xs font-medium border border-[#D8CFC2] bg-white text-[#111111] focus:outline-none focus:border-[#111111]"
          >
            <option value="featured">Sélection en vedette</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
          </select>

          <span className="text-xs text-[#5A554E] tabular-nums ml-2">
            {filtered.length} {filtered.length > 1 ? 'pièces' : 'pièce'}
          </span>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="py-6 px-6 bg-[#F2ECE3]/60 border-b border-[#E6DFD5] grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-2">Catégorie</label>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#D8CFC2] text-[#111111]"
            >
              <option value="">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-2">
              Prix maximum : <span className="tabular-nums">{maxPrice} MAD</span>
            </label>
            <input
              type="range"
              min={500}
              max={5000}
              step={100}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#111111]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-2">Taille</label>
            <div className="flex flex-wrap gap-1.5">
              {allSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(selectedSize === sz ? '' : sz)}
                  className={`px-2.5 py-1 text-xs border transition-colors cursor-pointer ${
                    selectedSize === sz
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#111111] border-[#D8CFC2] hover:border-[#111111]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#111111]">Couleur</label>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 text-xs text-[#9A7D43] hover:underline cursor-pointer"
              >
                <X className="w-3 h-3" /> Réinitialiser
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allColors.map((col) => (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => setSelectedColor(selectedColor === col.name ? '' : col.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors cursor-pointer ${
                    selectedColor === col.name
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#111111] border-[#D8CFC2]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: col.hex }}
                  />
                  <span>{col.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-base text-[#5A554E]">Aucune pièce ne correspond à ces critères.</p>
          <button
            type="button"
            onClick={resetAll}
            className="mt-5 px-6 py-2.5 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      )}
    </main>
  );
}
