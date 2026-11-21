export type Locale = 'fr' | 'en' | 'ar';

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  alt_text: string;
  is_primary: number | boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size: string;
  color_name: string;
  color_hex: string;
  stock_qty: number;
  sku_variant: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price_mad: number;
  promo_price_mad: number | null;
  category_id: number;
  category_name: string;
  category_slug: string;
  gender: 'femme' | 'homme' | 'accessoires' | 'mixte';
  material: string;
  care_instructions: string;
  is_active: boolean;
  is_featured: boolean;
  total_stock: number;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  gender: string;
  description: string;
  display_order: number;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  logo_text: string;
  slogan: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  email: string;
  currency: string;
  terms_text: string;
  return_policy_text: string;
  updated_at?: string;
}

export interface ShippingZone {
  id: number;
  zone_name: string;
  city_pattern: string;
  fee_mad: number;
  free_above_mad: number;
  estimated_days: string;
  is_active: number | boolean;
}

export interface CartItem {
  product_id: number;
  variant_id: number;
  slug: string;
  name: string;
  sku: string;
  size: string;
  color_name: string;
  color_hex: string;
  unit_price_mad: number;
  image_url: string;
  quantity: number;
  max_stock: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'admin' | 'manager' | 'customer';
  mustChangePassword: boolean;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  variant_id: number | null;
  product_name: string;
  sku: string;
  size: string;
  color_name: string;
  unit_price_mad: number;
  quantity: number;
  line_total_mad: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_city: string;
  shipping_address: string;
  postal_code: string;
  status: string;
  subtotal_mad: number;
  discount_mad: number;
  shipping_fee_mad: number;
  total_mad: number;
  coupon_code: string;
  notes: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}
