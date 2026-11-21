import type { Locale } from '../types/index.ts';

interface Dictionary {
  nav: {
    shop: string;
    women: string;
    men: string;
    accessories: string;
    account: string;
    bag: string;
  };
  hero: {
    eyebrow: string;
    ctaPrimary: string;
    ctaSecondary: string;
    subtitle: string;
  };
  catalog: {
    title: string;
    searchPlaceholder: string;
    allCategories: string;
    inStock: string;
    outOfStock: string;
    addToBag: string;
    selectSize: string;
    selectColor: string;
    noResults: string;
    resetFilters: string;
  };
  cart: {
    title: string;
    empty: string;
    subtotal: string;
    checkout: string;
    continueShopping: string;
  };
  footer: {
    deliveryReturns: string;
    contact: string;
    clientSpace: string;
    admin: string;
    codNotice: string;
  };
}

export const TRANSLATIONS: Record<Locale, Dictionary> = {
  fr: {
    nav: {
      shop: 'Boutique',
      women: 'Femme',
      men: 'Homme',
      accessories: 'Accessoires',
      account: 'Espace Client',
      bag: 'Panier',
    },
    hero: {
      eyebrow: 'Casablanca · Collection Atelier',
      ctaPrimary: 'Découvrir la collection',
      ctaSecondary: 'Suivre une commande',
      subtitle: 'Silhouettes architecturales, étoffes nobles et maroquinerie façonnée avec exigence entre Casablanca et nos ateliers partenaires.',
    },
    catalog: {
      title: 'La Collection',
      searchPlaceholder: 'Rechercher une pièce, référence SKU...',
      allCategories: 'Toutes les pièces',
      inStock: 'En stock',
      outOfStock: 'Rupture',
      addToBag: 'Ajouter au panier',
      selectSize: 'Taille',
      selectColor: 'Couleur',
      noResults: 'Aucune pièce ne correspond à ces critères.',
      resetFilters: 'Réinitialiser les filtres',
    },
    cart: {
      title: 'Votre Panier',
      empty: 'Votre panier est actuellement vide.',
      subtotal: 'Sous-total',
      checkout: 'Finaliser la commande',
      continueShopping: 'Poursuivre mes achats',
    },
    footer: {
      deliveryReturns: 'Livraison & Retours',
      contact: 'Contact & Showroom',
      clientSpace: 'Espace Client',
      admin: 'Administration',
      codNotice: 'Paiement à la livraison dans tout le Maroc',
    },
  },
  en: {
    nav: {
      shop: 'Shop',
      women: 'Women',
      men: 'Men',
      accessories: 'Accessories',
      account: 'Client Area',
      bag: 'Bag',
    },
    hero: {
      eyebrow: 'Casablanca · Atelier Collection',
      ctaPrimary: 'Explore Collection',
      ctaSecondary: 'Track Order',
      subtitle: 'Architectural silhouettes, fine natural fabrics and leather craftsmanship tailored for modern Casablanca.',
    },
    catalog: {
      title: 'The Collection',
      searchPlaceholder: 'Search pieces, SKU...',
      allCategories: 'All Pieces',
      inStock: 'In Stock',
      outOfStock: 'Sold Out',
      addToBag: 'Add to Bag',
      selectSize: 'Size',
      selectColor: 'Color',
      noResults: 'No pieces match your selection.',
      resetFilters: 'Reset filters',
    },
    cart: {
      title: 'Shopping Bag',
      empty: 'Your shopping bag is currently empty.',
      subtotal: 'Subtotal',
      checkout: 'Proceed to Checkout',
      continueShopping: 'Continue Shopping',
    },
    footer: {
      deliveryReturns: 'Shipping & Returns',
      contact: 'Contact & Showroom',
      clientSpace: 'Client Area',
      admin: 'Admin',
      codNotice: 'Cash on Delivery across Morocco',
    },
  },
  ar: {
    nav: {
      shop: 'المتجر',
      women: 'نسائي',
      men: 'رجالي',
      accessories: 'إكسسوارات',
      account: 'حسابي',
      bag: 'الحقيبة',
    },
    hero: {
      eyebrow: 'الدار البيضاء · مجموعة الأتيلييه',
      ctaPrimary: 'اكتشف المجموعة',
      ctaSecondary: 'تتبع الطلب',
      subtitle: 'تصاميم عصرية أنيقة وأقمشة فاخرة ومصنوعات جلدية راقية من قلب الدار البيضاء.',
    },
    catalog: {
      title: 'المجموعة الكاملة',
      searchPlaceholder: 'ابحث عن قطعة أو رمز المنتج...',
      allCategories: 'جميع القطع',
      inStock: 'متوفر',
      outOfStock: 'نفدت الكمية',
      addToBag: 'أضف إلى الحقيبة',
      selectSize: 'المقاس',
      selectColor: 'اللون',
      noResults: 'لا توجد قطع مطابقة لبحثك.',
      resetFilters: 'إعادة ضبط الفلاتر',
    },
    cart: {
      title: 'حقيبة التسوق',
      empty: 'حقيبة التسوق فارغة حالياً.',
      subtotal: 'المجموع الفرعي',
      checkout: 'إتمام الطلب',
      continueShopping: 'مواصلة التسوق',
    },
    footer: {
      deliveryReturns: 'التوصيل والاسترجاع',
      contact: 'اتصل بنا',
      clientSpace: 'فضاء الزبون',
      admin: 'الإدارة',
      codNotice: 'الدفع عند الاستلام في جميع أنحاء المغرب',
    },
  },
};
