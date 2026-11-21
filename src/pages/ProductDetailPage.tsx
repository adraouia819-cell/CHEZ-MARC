import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ShieldCheck, Truck } from 'lucide-react';
import { StudioImage } from '../components/StudioImage.tsx';
import { formatMad } from '../lib/api.ts';
import type { CartItem, Product } from '../types/index.ts';

interface ProductDetailPageProps {
  slug: string;
  products: Product[];
  onBack: () => void;
  onAddToCart: (item: CartItem) => void;
}

export function ProductDetailPage({ slug, products, onBack, onAddToCart }: ProductDetailPageProps) {
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  const product = useMemo(() => {
    return products.find((p) => p.slug === slug) || fetchedProduct;
  }, [products, slug, fetchedProduct]);

  useEffect(() => {
    if (!products.some((p) => p.slug === slug)) {
      setLoading(true);
      fetch(`/api/products/${encodeURIComponent(slug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.product) setFetchedProduct(data.product);
        })
        .finally(() => setLoading(false));
    }
  }, [slug, products]);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    if (product && product.variants.length > 0) {
      const firstAvailable = product.variants.find((v) => v.stock_qty > 0) || product.variants[0];
      setSelectedColor(firstAvailable.color_name);
      setSelectedSize(firstAvailable.size);
      setActiveImageIdx(0);
    }
  }, [product]);

  if (loading) {
    return (
      <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
        <div className="h-96 bg-[#F2ECE3] animate-pulse" />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-20 text-center">
        <h1 className="font-display text-3xl text-[#111111]">Pièce introuvable</h1>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 px-6 py-3 bg-[#111111] text-[#FAF8F5] text-xs uppercase tracking-wider cursor-pointer"
        >
          Retour au catalogue
        </button>
      </main>
    );
  }

  const colors = Array.from(
    new Map(product.variants.map((v) => [v.color_name, v.color_hex])).entries()
  ).map(([name, hex]) => ({ name, hex }));

  const sizesForColor = product.variants.filter((v) => v.color_name === selectedColor);
  const activeVariant =
    product.variants.find((v) => v.color_name === selectedColor && v.size === selectedSize) ||
    sizesForColor[0] ||
    product.variants[0];

  const effectivePrice = product.promo_price_mad ?? product.price_mad;
  const hasPromo = product.promo_price_mad !== null && product.promo_price_mad < product.price_mad;
  const isAvailable = Boolean(activeVariant && activeVariant.stock_qty > 0);

  const handleAdd = () => {
    if (!activeVariant || activeVariant.stock_qty <= 0) return;
    onAddToCart({
      product_id: product.id,
      variant_id: activeVariant.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      size: activeVariant.size,
      color_name: activeVariant.color_name,
      color_hex: activeVariant.color_hex,
      unit_price_mad: effectivePrice,
      image_url: product.images[0]?.image_url || '',
      quantity: 1,
      max_stock: activeVariant.stock_qty,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  return (
    <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-10 lg:py-16">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#5A554E] hover:text-[#111111] mb-8 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Retour à la collection</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        {/* Left: Sticky Multi-Photo Studio Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2ECE3] border border-[#E6DFD5]">
            <StudioImage
              src={product.images[activeImageIdx]?.image_url || product.images[0]?.image_url}
              alt={product.images[activeImageIdx]?.alt_text || product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-[4/3] overflow-hidden bg-[#F2ECE3] border transition-colors cursor-pointer ${
                    activeImageIdx === idx ? 'border-[#111111]' : 'border-[#E6DFD5] opacity-75 hover:opacity-100'
                  }`}
                >
                  <StudioImage src={img.image_url} alt={img.alt_text || product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#5A554E]">
              <span>{product.category_name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.sku}</span>
            </div>

            <h1 className="mt-2 font-display text-3xl lg:text-4xl font-medium text-[#111111] leading-tight">
              {product.name}
            </h1>

            <div className="mt-4 flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-semibold text-[#111111]">
                {formatMad(effectivePrice)}
              </span>
              {hasPromo && (
                <span className="text-sm text-[#5A554E] line-through">
                  {formatMad(product.price_mad)}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#5A554E] border-t border-[#E6DFD5] pt-5">
            {product.description}
          </p>

          {/* Color Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold text-[#111111]">Couleur</span>
              <span className="text-[#5A554E]">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setSelectedColor(c.name);
                    const nextVar = product.variants.find((v) => v.color_name === c.name && v.stock_qty > 0);
                    if (nextVar) setSelectedSize(nextVar.size);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-xs border transition-colors cursor-pointer ${
                    selectedColor === c.name
                      ? 'border-[#111111] bg-white font-medium text-[#111111]'
                      : 'border-[#D8CFC2] bg-transparent text-[#5A554E] hover:border-[#111111]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold text-[#111111]">Taille</span>
              <span className="text-[#5A554E] tabular-nums">
                {activeVariant
                  ? activeVariant.stock_qty > 0
                    ? `${activeVariant.stock_qty} disponible${activeVariant.stock_qty > 1 ? 's' : ''}`
                    : 'Rupture de stock'
                  : ''}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {sizesForColor.map((v) => {
                const selected = activeVariant?.id === v.id;
                const soldOut = v.stock_qty <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => setSelectedSize(v.size)}
                    className={`py-2.5 text-xs font-medium border transition-colors ${
                      soldOut
                        ? 'border-[#E6DFD5] bg-[#F2ECE3]/50 text-[#5A554E]/50 line-through cursor-not-allowed'
                        : selected
                        ? 'border-[#111111] bg-[#111111] text-[#FAF8F5] cursor-pointer'
                        : 'border-[#D8CFC2] bg-white text-[#111111] hover:border-[#111111] cursor-pointer'
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary CTA */}
          <button
            type="button"
            disabled={!isAvailable}
            onClick={handleAdd}
            className="w-full py-4 px-6 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] disabled:bg-[#D8CFC2] disabled:text-[#5A554E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {addedFeedback ? (
              <>
                <Check className="w-4 h-4 text-[#B89B5E]" />
                <span>Ajouté au panier</span>
              </>
            ) : isAvailable ? (
              <span>Ajouter au panier · {formatMad(effectivePrice)}</span>
            ) : (
              <span>Rupture de stock</span>
            )}
          </button>

          {/* Details & Guarantees */}
          <div className="border-t border-[#E6DFD5] pt-5 space-y-3 text-xs text-[#5A554E]">
            {product.material && (
              <div>
                <span className="font-semibold text-[#111111]">Matière : </span>
                <span>{product.material}</span>
              </div>
            )}
            {product.care_instructions && (
              <div>
                <span className="font-semibold text-[#111111]">Entretien : </span>
                <span>{product.care_instructions}</span>
              </div>
            )}
            <div className="pt-2 flex flex-col gap-2 text-[#111111]">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-[#9A7D43] shrink-0" />
                <span>Livraison express Casablanca (24h) & Maroc (48-72h)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#9A7D43] shrink-0" />
                <span>Paiement à la livraison (Cash on Delivery) & retours sous 14 jours</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
