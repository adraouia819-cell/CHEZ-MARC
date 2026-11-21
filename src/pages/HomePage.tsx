import { ArrowRight } from 'lucide-react';
import { ProductCard } from '../components/ProductCard.tsx';
import { StudioImage } from '../components/StudioImage.tsx';
import type { Product, StoreSettings } from '../types/index.ts';

interface HomePageProps {
  featuredProducts: Product[];
  storeSettings: StoreSettings | null;
  onNavigate: (path: string) => void;
  labels: {
    eyebrow: string;
    ctaPrimary: string;
    ctaSecondary: string;
    subtitle: string;
  };
}

export function HomePage({ featuredProducts, storeSettings, onNavigate, labels }: HomePageProps) {
  const slogan = storeSettings?.slogan || 'Votre style, votre identité.';

  return (
    <main>
      {/* Section 1: Editorial Storefront Hero */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-8 pb-16 lg:pt-12 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between py-4 lg:py-8">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-[#9A7D43] uppercase">
                {labels.eyebrow}
              </p>
              <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-medium leading-[1.08] tracking-tight text-[#111111]">
                {slogan}
              </h1>
              <p className="mt-6 text-[15px] leading-relaxed text-[#5A554E] max-w-md">
                {labels.subtitle}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => onNavigate('/catalogue')}
                className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{labels.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/compte')}
                className="text-xs font-medium tracking-wide text-[#111111] underline underline-offset-4 decoration-[#B89B5E] hover:text-[#9A7D43] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {labels.ctaSecondary}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full min-h-[340px] lg:min-h-[480px] overflow-hidden bg-[#F2ECE3] border border-[#E6DFD5]">
              <StudioImage
                src="/src/assets/images/hero_casa_editorial_1795271381879.jpg"
                alt="Campagne CASA STYLE Casablanca"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Featured Collection Grid */}
      <section className="border-t border-[#E6DFD5] bg-[#FAF8F5]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10 border-b border-[#E6DFD5]">
            <div>
              <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Sélection Signature</p>
              <h2 className="mt-2 font-display text-3xl lg:text-4xl font-medium text-[#111111]">
                Pièces Essentielles
              </h2>
            </div>
            <div className="flex items-center gap-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => onNavigate('/catalogue?gender=femme')}
                className="text-[#5A554E] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Femme
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/catalogue?gender=homme')}
                className="text-[#5A554E] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Homme
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/catalogue?gender=accessoires')}
                className="text-[#5A554E] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Accessoires
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/catalogue')}
                className="text-[#111111] underline underline-offset-4 decoration-[#B89B5E] cursor-pointer whitespace-nowrap shrink-0"
              >
                Tout voir
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {featuredProducts.slice(0, 6).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={(slug) => onNavigate(`/produit/${slug}`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Casablanca Savoir-Faire & Delivery Craft */}
      <section className="border-t border-[#E6DFD5] bg-[#F2ECE3]/65">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <p className="text-xs tracking-[0.14em] text-[#9A7D43] uppercase">Maison Casabalancaise</p>
              <h2 className="mt-3 font-display text-3xl lg:text-4xl font-medium text-[#111111] leading-tight">
                L’allure épurée, pensée au cœur du quartier Racine
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[#5A554E]">
                Chaque pièce CASA STYLE privilégie des coupes nettes, une palette intemporelle noir, écru et sable, et des matières sélectionnées pour leur tenue durable. Commandez en ligne et réglez en toute sérénité à la livraison partout au Maroc.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-[#D8CFC2]">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Casablanca 24h</p>
                  <p className="mt-1 text-xs text-[#5A554E]">Coursier dédié, offert dès 1 500 MAD</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Tout le Maroc</p>
                  <p className="mt-1 text-xs text-[#5A554E]">Expédition suivie sous 24h à 72h</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Paiement Livraison</p>
                  <p className="mt-1 text-xs text-[#5A554E]">Contrôle à réception avant règlement</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="aspect-[4/3] overflow-hidden bg-[#FAF8F5] border border-[#E6DFD5]">
                <StudioImage
                  src="/src/assets/images/product_trench_sable_1795271382596.jpg"
                  alt="Trench gabardine CASA STYLE"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[4/3] overflow-hidden bg-[#FAF8F5] border border-[#E6DFD5]">
                <StudioImage
                  src="/src/assets/images/product_sac_cuir_1795271382806.jpg"
                  alt="Maroquinerie CASA STYLE"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
