import { formatMad } from '../lib/api.ts';
import type { Product } from '../types/index.ts';
import { StudioImage } from './StudioImage.tsx';

interface ProductCardProps {
  product: Product;
  onSelect: (slug: string) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const primaryImage = product.images[0]?.image_url;
  const effectivePrice = product.promo_price_mad ?? product.price_mad;
  const hasPromo = product.promo_price_mad !== null && product.promo_price_mad < product.price_mad;
  const inStock = product.total_stock > 0;

  return (
    <article
      onClick={() => onSelect(product.slug)}
      className="group cursor-pointer flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F2ECE3] border border-[#E6DFD5]">
        <StudioImage
          src={primaryImage}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="pt-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-[#5A554E]">
          <span>{product.category_name}</span>
          <span aria-hidden="true">·</span>
          <span className={inStock ? 'text-[#5A554E]' : 'text-[#991B1B] font-medium'}>
            {inStock ? 'En stock' : 'Rupture'}
          </span>
        </div>

        <h3 className="text-[16px] font-semibold text-[#111111] leading-snug group-hover:text-[#9A7D43] transition-colors">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2.5 pt-0.5 tabular-nums">
          <span className="text-[15px] font-medium text-[#111111]">
            {formatMad(effectivePrice)}
          </span>
          {hasPromo && (
            <span className="text-xs text-[#5A554E] line-through">
              {formatMad(product.price_mad)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
