import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { formatMad } from '../lib/api.ts';
import type { CartItem } from '../types/index.ts';
import { StudioImage } from './StudioImage.tsx';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (variantId: number, delta: number) => void;
  onRemove: (variantId: number) => void;
  onCheckout: () => void;
  labels: {
    title: string;
    empty: string;
    subtotal: string;
    checkout: string;
    continueShopping: string;
  };
}

export function CartDrawer({
  isOpen,
  items,
  onClose,
  onUpdateQty,
  onRemove,
  onCheckout,
  labels,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unit_price_mad * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#111111]/45 backdrop-blur-[2px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#FAF8F5] border-l border-[#E6DFD5] shadow-2xl"
        aria-label={labels.title}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-[#9A7D43]" />
            <h2 className="font-display text-2xl font-medium tracking-tight text-[#111111]">
              {labels.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#5A554E] hover:text-[#111111] transition-colors cursor-pointer"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <p className="text-sm text-[#5A554E]">{labels.empty}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-6 py-2.5 text-xs font-medium tracking-wide bg-[#111111] text-[#FAF8F5] hover:bg-[#2A2622] transition-colors cursor-pointer"
              >
                {labels.continueShopping}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#E6DFD5]">
              {items.map((item) => (
                <li key={item.variant_id} className="py-5 first:pt-0 flex gap-4">
                  <div className="w-20 h-24 shrink-0 bg-[#F2ECE3] overflow-hidden border border-[#E6DFD5]">
                    <StudioImage
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#111111] leading-snug truncate">
                          {item.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemove(item.variant_id)}
                          className="text-[#5A554E] hover:text-[#991B1B] p-1 transition-colors cursor-pointer"
                          aria-label={`Retirer ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-[#5A554E]">
                        {item.size} · {item.color_name}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center border border-[#D8CFC2] bg-white">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.variant_id, -1)}
                          className="w-8 h-8 flex items-center justify-center text-[#111111] hover:bg-[#F2ECE3] transition-colors cursor-pointer"
                          aria-label="Diminuer la quantité"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.variant_id, 1)}
                          disabled={item.quantity >= item.max_stock}
                          className="w-8 h-8 flex items-center justify-center text-[#111111] hover:bg-[#F2ECE3] disabled:opacity-40 transition-colors cursor-pointer"
                          aria-label="Augmenter la quantité"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-medium text-[#111111] tabular-nums">
                        {formatMad(item.unit_price_mad * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#E6DFD5] bg-[#F2ECE3]/60 px-6 py-5">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-[#5A554E]">{labels.subtotal}</span>
              <span className="text-base font-semibold text-[#111111] tabular-nums">
                {formatMad(subtotal)}
              </span>
            </div>
            <p className="text-xs text-[#5A554E] mb-4">
              Frais de livraison calculés à l’étape suivante · Paiement à la livraison (COD)
            </p>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 px-6 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] transition-colors cursor-pointer"
            >
              {labels.checkout}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
