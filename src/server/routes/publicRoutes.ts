import { Router } from 'express';
import { getDb } from '../../db/database.ts';
import { createRateLimiter, extractAccessToken, sanitizeText, verifyAccessToken } from '../security.ts';

export const publicRouter = Router();

const orderRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 20,
  message: 'Trop de commandes soumises récemment. Veuillez patienter quelques minutes.',
});

const contactRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  message: 'Trop de messages envoyés. Veuillez réessayer plus tard.',
});

function hydrateProducts(db: ReturnType<typeof getDb>, productRows: Array<Record<string, unknown>>) {
  if (productRows.length === 0) return [];
  const imgStmt = db.prepare(
    'SELECT id, product_id, image_url, alt_text, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC'
  );
  const varStmt = db.prepare(
    'SELECT id, product_id, size, color_name, color_hex, stock_qty, sku_variant FROM product_variants WHERE product_id = ? ORDER BY id ASC'
  );

  return productRows.map((p) => {
    const pid = Number(p.id);
    const images = imgStmt.all(pid) as Array<Record<string, unknown>>;
    const variants = varStmt.all(pid) as Array<Record<string, unknown>>;
    const totalStock = variants.reduce((sum, v) => sum + Number(v.stock_qty || 0), 0);
    return {
      ...p,
      is_active: Boolean(p.is_active),
      is_featured: Boolean(p.is_featured),
      total_stock: totalStock,
      images,
      variants,
    };
  });
}

publicRouter.get('/store-info', (_req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
  const shipping = db.prepare('SELECT * FROM shipping_settings WHERE is_active = 1 ORDER BY fee_mad ASC').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, id ASC').all();
  res.json({ settings, shipping, categories });
});

publicRouter.get('/products', (req, res) => {
  const db = getDb();
  const gender = sanitizeText(req.query.gender, 30).toLowerCase();
  const category = sanitizeText(req.query.category, 60).toLowerCase();
  const search = sanitizeText(req.query.search, 100).toLowerCase();
  const size = sanitizeText(req.query.size, 20);
  const color = sanitizeText(req.query.color, 40).toLowerCase();
  const featured = req.query.featured === '1' || req.query.featured === 'true';
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const sort = sanitizeText(req.query.sort, 30);

  const conditions: string[] = ['p.is_active = 1'];
  const params: Array<string | number> = [];

  if (gender && ['femme', 'homme', 'accessoires'].includes(gender)) {
    conditions.push('p.gender = ?');
    params.push(gender);
  }

  if (category) {
    conditions.push('c.slug = ?');
    params.push(category);
  }

  if (featured) {
    conditions.push('p.is_featured = 1');
  }

  if (search) {
    conditions.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.sku) LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0) {
    conditions.push('COALESCE(p.promo_price_mad, p.price_mad) >= ?');
    params.push(minPrice);
  }

  if (maxPrice !== null && Number.isFinite(maxPrice) && maxPrice >= 0) {
    conditions.push('COALESCE(p.promo_price_mad, p.price_mad) <= ?');
    params.push(maxPrice);
  }

  if (size) {
    conditions.push('EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = ? AND pv.stock_qty > 0)');
    params.push(size);
  }

  if (color) {
    conditions.push('EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND LOWER(pv.color_name) LIKE ? AND pv.stock_qty > 0)');
    params.push(`%${color}%`);
  }

  let orderBy = 'p.is_featured DESC, p.created_at DESC';
  if (sort === 'price_asc') orderBy = 'COALESCE(p.promo_price_mad, p.price_mad) ASC';
  else if (sort === 'price_desc') orderBy = 'COALESCE(p.promo_price_mad, p.price_mad) DESC';
  else if (sort === 'newest') orderBy = 'p.created_at DESC';

  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}`
    )
    .all(...params) as Array<Record<string, unknown>>;

  res.json({ products: hydrateProducts(db, rows) });
});

publicRouter.get('/products/:slug', (req, res) => {
  const db = getDb();
  const slug = sanitizeText(req.params.slug, 120);
  const row = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.is_active = 1`
    )
    .get(slug) as Record<string, unknown> | undefined;

  if (!row) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  const [product] = hydrateProducts(db, [row]);
  return res.json({ product });
});

export function computeShippingForCity(
  db: ReturnType<typeof getDb>,
  cityInput: string,
  subtotalMad: number
): { zoneName: string; feeMad: number; freeAboveMad: number; estimatedDays: string } {
  const city = cityInput.trim().toLowerCase();
  const zones = db
    .prepare('SELECT * FROM shipping_settings WHERE is_active = 1 ORDER BY id ASC')
    .all() as Array<{
    zone_name: string;
    city_pattern: string;
    fee_mad: number;
    free_above_mad: number;
    estimated_days: string;
  }>;

  let matched = zones.find((z) => {
    if (z.city_pattern === '*') return false;
    return z.city_pattern
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .some((pat) => city.includes(pat));
  });

  if (!matched) {
    matched = zones.find((z) => z.city_pattern === '*') || zones[0];
  }

  if (!matched) {
    return {
      zoneName: 'Maroc Standard',
      feeMad: subtotalMad >= 1500 ? 0 : 45,
      freeAboveMad: 1500,
      estimatedDays: '24h - 72h',
    };
  }

  const feeMad = subtotalMad >= matched.free_above_mad ? 0 : Number(matched.fee_mad);
  return {
    zoneName: matched.zone_name,
    feeMad,
    freeAboveMad: Number(matched.free_above_mad),
    estimatedDays: matched.estimated_days,
  };
}

publicRouter.post('/shipping/calculate', (req, res) => {
  const db = getDb();
  const city = sanitizeText(req.body?.city, 80) || 'Casablanca';
  const subtotal = Math.max(0, Number(req.body?.subtotal_mad || 0));
  const result = computeShippingForCity(db, city, subtotal);
  res.json(result);
});

function evaluateCoupon(
  db: ReturnType<typeof getDb>,
  codeRaw: string,
  subtotalMad: number
): { valid: boolean; discountMad: number; message: string; coupon?: Record<string, unknown> } {
  const code = sanitizeText(codeRaw, 40).toUpperCase();
  if (!code) {
    return { valid: false, discountMad: 0, message: 'Code promotionnel vide.' };
  }

  const coupon = db
    .prepare('SELECT * FROM coupons WHERE UPPER(code) = ?')
    .get(code) as
    | {
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
    | undefined;

  if (!coupon || !coupon.is_active) {
    return { valid: false, discountMad: 0, message: 'Ce code promotionnel est invalide ou expiré.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today < coupon.start_date || today > coupon.end_date) {
    return { valid: false, discountMad: 0, message: 'Ce code promotionnel n’est plus valide à cette date.' };
  }

  if (coupon.uses_count >= coupon.max_uses) {
    return { valid: false, discountMad: 0, message: 'Ce code promotionnel a atteint son nombre maximal d’utilisations.' };
  }

  if (subtotalMad < coupon.min_order_mad) {
    return {
      valid: false,
      discountMad: 0,
      message: `Minimum d’achat requis de ${coupon.min_order_mad.toFixed(0)} MAD pour ce code.`,
    };
  }

  const discountMad =
    coupon.discount_type === 'percentage'
      ? Math.round((subtotalMad * coupon.discount_value) / 100 * 100) / 100
      : Math.min(subtotalMad, coupon.discount_value);

  return {
    valid: true,
    discountMad,
    message: `Code ${coupon.code} appliqué (-${discountMad.toFixed(0)} MAD).`,
    coupon,
  };
}

publicRouter.post('/coupons/validate', (req, res) => {
  const db = getDb();
  const code = sanitizeText(req.body?.code, 40);
  const subtotal = Math.max(0, Number(req.body?.subtotal_mad || 0));
  const evaluation = evaluateCoupon(db, code, subtotal);
  if (!evaluation.valid) {
    return res.status(400).json({ valid: false, error: evaluation.message });
  }
  return res.json({
    valid: true,
    discount_mad: evaluation.discountMad,
    message: evaluation.message,
  });
});

publicRouter.post('/orders', orderRateLimiter, (req, res) => {
  const db = getDb();
  const body = req.body || {};

  const customerName = sanitizeText(body.customer_name, 120);
  const customerEmail = sanitizeText(body.customer_email, 140).toLowerCase();
  const customerPhone = sanitizeText(body.customer_phone, 40);
  const shippingCity = sanitizeText(body.shipping_city, 80);
  const shippingAddress = sanitizeText(body.shipping_address, 300);
  const postalCode = sanitizeText(body.postal_code, 20);
  const couponCode = sanitizeText(body.coupon_code, 40).toUpperCase();
  const notes = sanitizeText(body.notes, 400);
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!customerName || customerName.length < 2) {
    return res.status(400).json({ error: 'Veuillez renseigner votre nom complet.' });
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ error: 'Veuillez renseigner une adresse e-mail valide.' });
  }
  if (!customerPhone || customerPhone.length < 8) {
    return res.status(400).json({ error: 'Veuillez renseigner un numéro de téléphone valide.' });
  }
  if (!shippingCity || !shippingAddress || shippingAddress.length < 5) {
    return res.status(400).json({ error: 'Veuillez renseigner votre ville et votre adresse complète de livraison.' });
  }
  if (rawItems.length === 0) {
    return res.status(400).json({ error: 'Votre panier est vide.' });
  }

  let linkedUserId: number | null = null;
  const token = extractAccessToken(req);
  if (token) {
    const authPayload = verifyAccessToken(token);
    if (authPayload) {
      linkedUserId = authPayload.sub;
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    let subtotalMad = 0;
    const preparedItems: Array<{
      productId: number;
      variantId: number;
      productName: string;
      sku: string;
      size: string;
      colorName: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const item of rawItems) {
      const variantId = Number(item.variant_id);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: 'Article ou quantité invalide dans votre panier.' });
      }

      const row = db
        .prepare(
          `SELECT pv.id as variant_id, pv.size, pv.color_name, pv.stock_qty,
                  p.id as product_id, p.name as product_name, p.sku, p.price_mad, p.promo_price_mad, p.is_active
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = ?`
        )
        .get(variantId) as
        | {
            variant_id: number;
            size: string;
            color_name: string;
            stock_qty: number;
            product_id: number;
            product_name: string;
            sku: string;
            price_mad: number;
            promo_price_mad: number | null;
            is_active: number;
          }
        | undefined;

      if (!row || !row.is_active) {
        db.exec('ROLLBACK;');
        return res.status(404).json({ error: 'Un article sélectionné n’est plus disponible.' });
      }

      if (row.stock_qty < quantity) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          error: `Stock insuffisant pour "${row.product_name}" (${row.size} · ${row.color_name}). Disponible : ${row.stock_qty}.`,
        });
      }

      const unitPrice = Number(row.promo_price_mad ?? row.price_mad);
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      subtotalMad += lineTotal;

      preparedItems.push({
        productId: row.product_id,
        variantId: row.variant_id,
        productName: row.product_name,
        sku: row.sku,
        size: row.size,
        colorName: row.color_name,
        unitPrice,
        quantity,
        lineTotal,
      });

      db.prepare('UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?').run(quantity, row.variant_id);
    }

    let discountMad = 0;
    let appliedCoupon = '';
    if (couponCode) {
      const evalRes = evaluateCoupon(db, couponCode, subtotalMad);
      if (!evalRes.valid) {
        db.exec('ROLLBACK;');
        return res.status(400).json({ error: evalRes.message });
      }
      discountMad = evalRes.discountMad;
      appliedCoupon = couponCode;
      db.prepare('UPDATE coupons SET uses_count = uses_count + 1 WHERE UPPER(code) = ?').run(couponCode);
    }

    const netSubtotal = Math.max(0, subtotalMad - discountMad);
    const shipping = computeShippingForCity(db, shippingCity, netSubtotal);
    const totalMad = Math.round((netSubtotal + shipping.feeMad) * 100) / 100;

    // Find or create customer
    const existingCustomer = db
      .prepare('SELECT id FROM customers WHERE LOWER(email) = ? OR phone = ? LIMIT 1')
      .get(customerEmail, customerPhone) as { id: number } | undefined;

    let customerId: number;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      db.prepare(
        `UPDATE customers SET full_name = ?, phone = ?, city = ?, address = ?, postal_code = ?, user_id = COALESCE(user_id, ?), updated_at = datetime('now')
         WHERE id = ?`
      ).run(customerName, customerPhone, shippingCity, shippingAddress, postalCode, linkedUserId, customerId);
    } else {
      customerId = db
        .prepare(
          `INSERT INTO customers (user_id, full_name, email, phone, city, address, postal_code)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(linkedUserId, customerName, customerEmail, customerPhone, shippingCity, shippingAddress, postalCode)
        .lastInsertRowid as number;
    }

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    const orderNumber = `CS-${year}-${randSuffix}${Date.now().toString().slice(-2)}`;

    const orderId = db
      .prepare(
        `INSERT INTO orders (
          order_number, customer_id, customer_name, customer_email, customer_phone,
          shipping_city, shipping_address, postal_code, status,
          subtotal_mad, discount_mad, shipping_fee_mad, total_mad, coupon_code, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Nouvelle commande', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        orderNumber,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        shippingCity,
        shippingAddress,
        postalCode,
        subtotalMad,
        discountMad,
        shipping.feeMad,
        totalMad,
        appliedCoupon,
        notes
      ).lastInsertRowid as number;

    const insertOrderItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, sku, size, color_name, unit_price_mad, quantity, line_total_mad
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const pi of preparedItems) {
      insertOrderItem.run(
        orderId,
        pi.productId,
        pi.variantId,
        pi.productName,
        pi.sku,
        pi.size,
        pi.colorName,
        pi.unitPrice,
        pi.quantity,
        pi.lineTotal
      );
    }

    db.prepare(
      `INSERT INTO payments (order_id, method, status, amount_mad, currency, provider, provider_reference)
       VALUES (?, 'COD', 'En attente', ?, 'MAD', 'cash_on_delivery', ?)`
    ).run(orderId, totalMad, `COD-${orderNumber}`);

    db.exec('COMMIT;');

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    return res.status(201).json({
      order: createdOrder,
      items,
      shipping,
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Order creation error:', err);
    return res.status(500).json({ error: 'Impossible de finaliser la commande pour le moment.' });
  }
});

publicRouter.get('/orders/track', (req, res) => {
  const db = getDb();
  const orderNumber = sanitizeText(req.query.orderNumber, 40).toUpperCase();
  const contact = sanitizeText(req.query.contact, 120).toLowerCase();

  if (!orderNumber || !contact) {
    return res.status(400).json({ error: 'Numéro de commande et téléphone ou e-mail requis.' });
  }

  const order = db
    .prepare(
      `SELECT id, order_number, customer_name, shipping_city, status, subtotal_mad, discount_mad, shipping_fee_mad, total_mad, coupon_code, created_at, updated_at
       FROM orders
       WHERE UPPER(order_number) = ? AND (LOWER(customer_email) = ? OR REPLACE(customer_phone, ' ', '') = REPLACE(?, ' ', ''))`
    )
    .get(orderNumber, contact, contact) as Record<string, unknown> | undefined;

  if (!order) {
    return res.status(404).json({ error: 'Aucune commande ne correspond à ces informations.' });
  }

  const items = db
    .prepare('SELECT product_name, size, color_name, unit_price_mad, quantity, line_total_mad FROM order_items WHERE order_id = ?')
    .all(Number(order.id));

  return res.json({ order, items });
});

publicRouter.post('/contact', contactRateLimiter, (req, res) => {
  const db = getDb();
  const fullName = sanitizeText(req.body?.full_name, 100);
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const phone = sanitizeText(req.body?.phone, 40);
  const subject = sanitizeText(req.body?.subject, 160);
  const message = sanitizeText(req.body?.message, 2000);

  if (!fullName || !email || !subject || !message) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être renseignés.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  db.prepare(
    'INSERT INTO contact_messages (full_name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)'
  ).run(fullName, email, phone, subject, message);

  return res.status(201).json({ success: true, message: 'Votre message a bien été transmis à la maison CASA STYLE.' });
});
