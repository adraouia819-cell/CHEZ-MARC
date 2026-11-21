import { Router } from 'express';
import { getDb } from '../../db/database.ts';
import { requireAdmin, sanitizeText, writeAuditLog, type AuthenticatedRequest } from '../security.ts';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

const ORDER_STATUSES = [
  'Nouvelle commande',
  'En attente de confirmation',
  'Confirmée',
  'En préparation',
  'Expédiée',
  'Livrée',
  'Annulée',
  'Retournée',
] as const;

adminRouter.get('/dashboard', (_req, res) => {
  const db = getDb();

  const revenueRow = db
    .prepare(
      `SELECT COALESCE(SUM(total_mad), 0) as total_revenue,
              COUNT(*) as valid_orders
       FROM orders
       WHERE status NOT IN ('Annulée', 'Retournée')`
    )
    .get() as { total_revenue: number; valid_orders: number };

  const orderCounts = db
    .prepare(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('Nouvelle commande', 'En attente de confirmation', 'Confirmée', 'En préparation') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'Expédiée' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'Livrée' THEN 1 ELSE 0 END) as delivered_orders
       FROM orders`
    )
    .get() as {
    total_orders: number;
    pending_orders: number;
    shipped_orders: number;
    delivered_orders: number;
  };

  const customerCount = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number }).count;

  const productStats = db
    .prepare(
      `SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 AND COALESCE((SELECT SUM(stock_qty) FROM product_variants pv WHERE pv.product_id = p.id), 0) > 0 THEN 1 ELSE 0 END) as available_products,
        SUM(CASE WHEN COALESCE((SELECT SUM(stock_qty) FROM product_variants pv WHERE pv.product_id = p.id), 0) = 0 THEN 1 ELSE 0 END) as out_of_stock_products
       FROM products p`
    )
    .get() as {
    total_products: number;
    available_products: number;
    out_of_stock_products: number;
  };

  const dailySales = db
    .prepare(
      `SELECT substr(created_at, 1, 10) as day,
              COUNT(*) as orders_count,
              COALESCE(SUM(total_mad), 0) as revenue_mad
       FROM orders
       WHERE status NOT IN ('Annulée', 'Retournée')
         AND created_at >= date('now', '-30 days')
       GROUP BY substr(created_at, 1, 10)
       ORDER BY day ASC`
    )
    .all();

  const monthlySales = db
    .prepare(
      `SELECT substr(created_at, 1, 7) as month,
              COUNT(*) as orders_count,
              COALESCE(SUM(total_mad), 0) as revenue_mad
       FROM orders
       WHERE status NOT IN ('Annulée', 'Retournée')
       GROUP BY substr(created_at, 1, 7)
       ORDER BY month ASC
       LIMIT 12`
    )
    .all();

  const topProducts = db
    .prepare(
      `SELECT oi.product_name,
              oi.sku,
              SUM(oi.quantity) as units_sold,
              SUM(oi.line_total_mad) as revenue_mad
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status NOT IN ('Annulée', 'Retournée')
       GROUP BY oi.product_id, oi.product_name, oi.sku
       ORDER BY units_sold DESC, revenue_mad DESC
       LIMIT 5`
    )
    .all();

  const ordersByStatus = db
    .prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(total_mad), 0) as revenue_mad
       FROM orders
       GROUP BY status
       ORDER BY count DESC`
    )
    .all();

  const recentOrders = db
    .prepare('SELECT id, order_number, customer_name, shipping_city, total_mad, status, created_at FROM orders ORDER BY created_at DESC LIMIT 6')
    .all();

  res.json({
    kpis: {
      totalRevenueMad: Number(revenueRow.total_revenue || 0),
      totalOrders: Number(orderCounts.total_orders || 0),
      totalCustomers: Number(customerCount || 0),
      totalProducts: Number(productStats.total_products || 0),
      availableProducts: Number(productStats.available_products || 0),
      outOfStockProducts: Number(productStats.out_of_stock_products || 0),
      pendingOrders: Number(orderCounts.pending_orders || 0),
      shippedOrders: Number(orderCounts.shipped_orders || 0),
      deliveredOrders: Number(orderCounts.delivered_orders || 0),
    },
    charts: {
      dailySales,
      monthlySales,
      topProducts,
      ordersByStatus,
    },
    recentOrders,
  });
});

adminRouter.get('/products', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC, p.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const imgStmt = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC');
  const varStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC');

  const products = rows.map((p) => {
    const pid = Number(p.id);
    const images = imgStmt.all(pid);
    const variants = varStmt.all(pid) as Array<{ stock_qty: number }>;
    const total_stock = variants.reduce((s, v) => s + Number(v.stock_qty || 0), 0);
    return {
      ...p,
      is_active: Boolean(p.is_active),
      is_featured: Boolean(p.is_featured),
      total_stock,
      images,
      variants,
    };
  });

  const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC').all();
  res.json({ products, categories });
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

adminRouter.post('/products', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const body = req.body || {};

  const name = sanitizeText(body.name, 140);
  const sku = sanitizeText(body.sku, 40).toUpperCase();
  const description = sanitizeText(body.description, 3000);
  const priceMad = Number(body.price_mad);
  const promoPriceMad = body.promo_price_mad !== null && body.promo_price_mad !== '' && body.promo_price_mad !== undefined
    ? Number(body.promo_price_mad)
    : null;
  const categoryId = Number(body.category_id);
  const gender = sanitizeText(body.gender, 20);
  const material = sanitizeText(body.material, 250);
  const careInstructions = sanitizeText(body.care_instructions, 300);
  const isActive = body.is_active !== false ? 1 : 0;
  const isFeatured = body.is_featured ? 1 : 0;
  const images = Array.isArray(body.images) ? body.images : [];
  const variants = Array.isArray(body.variants) ? body.variants : [];

  if (!name || !sku || !description || !Number.isFinite(priceMad) || priceMad <= 0 || !Number.isInteger(categoryId)) {
    return res.status(400).json({ error: 'Nom, SKU, description, catégorie et prix valides requis.' });
  }
  if (!['femme', 'homme', 'accessoires', 'mixte'].includes(gender)) {
    return res.status(400).json({ error: 'Genre de produit invalide.' });
  }
  if (variants.length === 0) {
    return res.status(400).json({ error: 'Veuillez ajouter au moins une variante (taille, couleur, stock).' });
  }

  const slug = `${slugify(name)}-${Date.now().toString().slice(-4)}`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    const prodId = db
      .prepare(
        `INSERT INTO products (
          name, slug, sku, description, price_mad, promo_price_mad, category_id, gender, material, care_instructions, is_active, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, slug, sku, description, priceMad, promoPriceMad, categoryId, gender, material, careInstructions, isActive, isFeatured)
      .lastInsertRowid as number;

    const insImg = db.prepare(
      'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    images.forEach((img: { image_url?: string; alt_text?: string; is_primary?: boolean }, idx: number) => {
      const url = sanitizeText(img.image_url, 400);
      if (url) {
        insImg.run(prodId, url, sanitizeText(img.alt_text, 160) || name, idx === 0 || img.is_primary ? 1 : 0, idx + 1);
      }
    });

    const insVar = db.prepare(
      'INSERT INTO product_variants (product_id, size, color_name, color_hex, stock_qty, sku_variant) VALUES (?, ?, ?, ?, ?, ?)'
    );
    variants.forEach((v: { size?: string; color_name?: string; color_hex?: string; stock_qty?: number }, idx: number) => {
      const size = sanitizeText(v.size, 20) || 'Unique';
      const colorName = sanitizeText(v.color_name, 50) || 'Noir';
      const colorHex = sanitizeText(v.color_hex, 20) || '#111111';
      const stockQty = Math.max(0, Math.floor(Number(v.stock_qty || 0)));
      const skuVar = `${sku}-${size}-${idx + 1}`.toUpperCase();
      insVar.run(prodId, size, colorName, colorHex, stockQty, skuVar);
    });

    writeAuditLog(db, {
      actorUserId: req.authUser!.sub,
      actorUsername: req.authUser!.username,
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: prodId,
      details: { name, sku, priceMad },
      ipAddress: req.ip,
    });

    db.exec('COMMIT;');
    return res.status(201).json({ id: prodId, slug });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Create product error:', err);
    return res.status(400).json({ error: 'Impossible de créer le produit (SKU peut-être déjà utilisé).' });
  }
});

adminRouter.put('/products/:id', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const body = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identifiant produit invalide.' });
  }

  const existing = db.prepare('SELECT id, sku FROM products WHERE id = ?').get(id) as { id: number; sku: string } | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  const name = sanitizeText(body.name, 140);
  const sku = sanitizeText(body.sku, 40).toUpperCase();
  const description = sanitizeText(body.description, 3000);
  const priceMad = Number(body.price_mad);
  const promoPriceMad = body.promo_price_mad !== null && body.promo_price_mad !== '' && body.promo_price_mad !== undefined
    ? Number(body.promo_price_mad)
    : null;
  const categoryId = Number(body.category_id);
  const gender = sanitizeText(body.gender, 20);
  const material = sanitizeText(body.material, 250);
  const careInstructions = sanitizeText(body.care_instructions, 300);
  const isActive = body.is_active ? 1 : 0;
  const isFeatured = body.is_featured ? 1 : 0;
  const images = Array.isArray(body.images) ? body.images : [];
  const variants = Array.isArray(body.variants) ? body.variants : [];

  if (!name || !sku || !Number.isFinite(priceMad) || priceMad <= 0) {
    return res.status(400).json({ error: 'Champs produit obligatoires manquants ou invalides.' });
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(
      `UPDATE products
       SET name = ?, sku = ?, description = ?, price_mad = ?, promo_price_mad = ?,
           category_id = ?, gender = ?, material = ?, care_instructions = ?,
           is_active = ?, is_featured = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(name, sku, description, priceMad, promoPriceMad, categoryId, gender, material, careInstructions, isActive, isFeatured, id);

    if (images.length > 0) {
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
      const insImg = db.prepare(
        'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
      );
      images.forEach((img: { image_url?: string; alt_text?: string; is_primary?: boolean }, idx: number) => {
        const url = sanitizeText(img.image_url, 400);
        if (url) {
          insImg.run(id, url, sanitizeText(img.alt_text, 160) || name, idx === 0 || img.is_primary ? 1 : 0, idx + 1);
        }
      });
    }

    if (variants.length > 0) {
      // Update existing variants by id or insert new ones, delete removed ones
      const existingVars = db.prepare('SELECT id FROM product_variants WHERE product_id = ?').all(id) as Array<{ id: number }>;
      const keepIds = new Set<number>();

      const updVar = db.prepare(
        'UPDATE product_variants SET size = ?, color_name = ?, color_hex = ?, stock_qty = ? WHERE id = ? AND product_id = ?'
      );
      const insVar = db.prepare(
        'INSERT INTO product_variants (product_id, size, color_name, color_hex, stock_qty, sku_variant) VALUES (?, ?, ?, ?, ?, ?)'
      );

      variants.forEach(
        (v: { id?: number; size?: string; color_name?: string; color_hex?: string; stock_qty?: number }, idx: number) => {
          const size = sanitizeText(v.size, 20) || 'Unique';
          const colorName = sanitizeText(v.color_name, 50) || 'Noir';
          const colorHex = sanitizeText(v.color_hex, 20) || '#111111';
          const stockQty = Math.max(0, Math.floor(Number(v.stock_qty || 0)));
          if (v.id && existingVars.some((ev) => ev.id === Number(v.id))) {
            keepIds.add(Number(v.id));
            updVar.run(size, colorName, colorHex, stockQty, Number(v.id), id);
          } else {
            const skuVar = `${sku}-${size}-${Date.now().toString().slice(-3)}-${idx + 1}`.toUpperCase();
            insVar.run(id, size, colorName, colorHex, stockQty, skuVar);
          }
        }
      );

      for (const ev of existingVars) {
        if (!keepIds.has(ev.id)) {
          db.prepare('DELETE FROM product_variants WHERE id = ?').run(ev.id);
        }
      }
    }

    writeAuditLog(db, {
      actorUserId: req.authUser!.sub,
      actorUsername: req.authUser!.username,
      action: 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: id,
      details: { name, sku, priceMad, isActive, isFeatured },
      ipAddress: req.ip,
    });

    db.exec('COMMIT;');
    return res.json({ success: true });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Update product error:', err);
    return res.status(400).json({ error: 'Erreur lors de la mise à jour du produit.' });
  }
});

adminRouter.delete('/products/:id', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identifiant produit invalide.' });
  }

  const orderRef = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').get(id) as { count: number };
  if (orderRef.count > 0) {
    db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    writeAuditLog(db, {
      actorUserId: req.authUser!.sub,
      actorUsername: req.authUser!.username,
      action: 'PRODUCT_ARCHIVED',
      entityType: 'product',
      entityId: id,
      details: { reason: 'Referenced by historical orders' },
      ipAddress: req.ip,
    });
    return res.json({
      success: true,
      archived: true,
      message: 'Produit archivé (désactivé) car il figure dans des commandes existantes.',
    });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'PRODUCT_DELETED',
    entityType: 'product',
    entityId: id,
    ipAddress: req.ip,
  });

  return res.json({ success: true, archived: false });
});

adminRouter.get('/orders', (req, res) => {
  const db = getDb();
  const q = sanitizeText(req.query.q, 80).toLowerCase();
  const status = sanitizeText(req.query.status, 50);

  const conditions: string[] = ['1=1'];
  const params: Array<string | number> = [];

  if (q) {
    conditions.push(
      "(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR REPLACE(o.customer_phone, ' ', '') LIKE ?)"
    );
    const like = `%${q}%`;
    const phoneLike = `%${q.replace(/\s+/g, '')}%`;
    params.push(like, like, phoneLike);
  }
  if (status && status !== 'Tous') {
    conditions.push('o.status = ?');
    params.push(status);
  }

  const orders = db
    .prepare(
      `SELECT o.*, p.method as payment_method, p.status as payment_status
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC, o.id DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const hydrated = orders.map((o) => ({
    ...o,
    items: itemStmt.all(Number(o.id)),
  }));

  res.json({ orders: hydrated, statuses: ORDER_STATUSES });
});

adminRouter.patch('/orders/:id/status', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const nextStatus = sanitizeText(req.body?.status, 50);

  if (!ORDER_STATUSES.includes(nextStatus as (typeof ORDER_STATUSES)[number])) {
    return res.status(400).json({ error: 'Statut de commande invalide.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | { id: number; order_number: string; status: string }
    | undefined;
  if (!order) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  const cancelledStates = new Set(['Annulée', 'Retournée']);
  const wasCancelled = cancelledStates.has(order.status);
  const willBeCancelled = cancelledStates.has(nextStatus);

  db.exec('BEGIN IMMEDIATE;');
  try {
    const items = db
      .prepare('SELECT variant_id, quantity, product_name FROM order_items WHERE order_id = ?')
      .all(id) as Array<{ variant_id: number | null; quantity: number; product_name: string }>;

    if (!wasCancelled && willBeCancelled) {
      for (const it of items) {
        if (it.variant_id) {
          db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(it.quantity, it.variant_id);
        }
      }
    } else if (wasCancelled && !willBeCancelled) {
      for (const it of items) {
        if (it.variant_id) {
          const variant = db.prepare('SELECT stock_qty FROM product_variants WHERE id = ?').get(it.variant_id) as
            | { stock_qty: number }
            | undefined;
          if (!variant || variant.stock_qty < it.quantity) {
            db.exec('ROLLBACK;');
            return res.status(409).json({
              error: `Stock insuffisant pour réactiver "${it.product_name}".`,
            });
          }
          db.prepare('UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?').run(it.quantity, it.variant_id);
        }
      }
    }

    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(nextStatus, id);

    let payStatus = 'En attente';
    if (nextStatus === 'Livrée') payStatus = 'Payé';
    else if (nextStatus === 'Annulée') payStatus = 'Annulé';
    else if (nextStatus === 'Retournée') payStatus = 'Remboursé';

    db.prepare("UPDATE payments SET status = ?, updated_at = datetime('now') WHERE order_id = ?").run(payStatus, id);

    writeAuditLog(db, {
      actorUserId: req.authUser!.sub,
      actorUsername: req.authUser!.username,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: order.order_number,
      details: { previousStatus: order.status, nextStatus },
      ipAddress: req.ip,
    });

    db.exec('COMMIT;');
    return res.json({ success: true, status: nextStatus, payment_status: payStatus });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Order status update error:', err);
    return res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

adminRouter.get('/customers', (req, res) => {
  const db = getDb();
  const q = sanitizeText(req.query.q, 80).toLowerCase();
  const params: Array<string> = [];
  let where = '';
  if (q) {
    where = "WHERE LOWER(c.full_name) LIKE ? OR LOWER(c.email) LIKE ? OR REPLACE(c.phone, ' ', '') LIKE ? OR LOWER(c.city) LIKE ?";
    const like = `%${q}%`;
    params.push(like, like, `%${q.replace(/\s+/g, '')}%`, like);
  }

  const customers = db
    .prepare(
      `SELECT c.*,
              COUNT(o.id) as orders_count,
              COALESCE(SUM(CASE WHEN o.status NOT IN ('Annulée', 'Retournée') THEN o.total_mad ELSE 0 END), 0) as total_spent_mad,
              MAX(o.created_at) as last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY total_spent_mad DESC, c.created_at DESC`
    )
    .all(...params);

  res.json({ customers });
});

adminRouter.get('/customers/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Client introuvable.' });
  }
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(id);
  return res.json({ customer, orders });
});

adminRouter.get('/promotions', (_req, res) => {
  const db = getDb();
  const promotions = db.prepare('SELECT * FROM promotions ORDER BY created_at DESC').all();
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  res.json({ promotions, coupons });
});

adminRouter.post('/promotions', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const body = req.body || {};
  const name = sanitizeText(body.name, 120);
  const description = sanitizeText(body.description, 400);
  const discountType = body.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = Number(body.discount_value);
  const startDate = sanitizeText(body.start_date, 20);
  const endDate = sanitizeText(body.end_date, 20);
  const productIds = Array.isArray(body.product_ids) ? body.product_ids.map(Number).filter(Number.isInteger) : [];

  if (!name || !Number.isFinite(discountValue) || discountValue <= 0 || !startDate || !endDate) {
    return res.status(400).json({ error: 'Paramètres de promotion invalides.' });
  }

  const promoId = db
    .prepare(
      `INSERT INTO promotions (name, description, discount_type, discount_value, start_date, end_date, is_active, product_ids_json)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(name, description, discountType, discountValue, startDate, endDate, JSON.stringify(productIds))
    .lastInsertRowid as number;

  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'PROMOTION_CREATED',
    entityType: 'promotion',
    entityId: promoId,
    details: { name, discountType, discountValue },
    ipAddress: req.ip,
  });

  return res.status(201).json({ id: promoId });
});

adminRouter.patch('/promotions/:id/toggle', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const row = db.prepare('SELECT is_active FROM promotions WHERE id = ?').get(id) as { is_active: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Promotion introuvable.' });
  const next = row.is_active ? 0 : 1;
  db.prepare('UPDATE promotions SET is_active = ? WHERE id = ?').run(next, id);
  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'PROMOTION_TOGGLED',
    entityType: 'promotion',
    entityId: id,
    details: { is_active: Boolean(next) },
    ipAddress: req.ip,
  });
  return res.json({ is_active: Boolean(next) });
});

adminRouter.post('/coupons', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const body = req.body || {};
  const code = sanitizeText(body.code, 30).toUpperCase().replace(/\s+/g, '');
  const discountType = body.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = Number(body.discount_value);
  const minOrderMad = Math.max(0, Number(body.min_order_mad || 0));
  const maxUses = Math.max(1, Math.floor(Number(body.max_uses || 100)));
  const startDate = sanitizeText(body.start_date, 20);
  const endDate = sanitizeText(body.end_date, 20);

  if (!code || !Number.isFinite(discountValue) || discountValue <= 0 || !startDate || !endDate) {
    return res.status(400).json({ error: 'Code promo ou paramètres invalides.' });
  }

  try {
    const id = db
      .prepare(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_mad, max_uses, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(code, discountType, discountValue, minOrderMad, maxUses, startDate, endDate).lastInsertRowid;

    writeAuditLog(db, {
      actorUserId: req.authUser!.sub,
      actorUsername: req.authUser!.username,
      action: 'COUPON_CREATED',
      entityType: 'coupon',
      entityId: code,
      ipAddress: req.ip,
    });

    return res.status(201).json({ id, code });
  } catch {
    return res.status(409).json({ error: 'Ce code promo existe déjà.' });
  }
});

adminRouter.patch('/coupons/:id/toggle', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const row = db.prepare('SELECT is_active, code FROM coupons WHERE id = ?').get(id) as
    | { is_active: number; code: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Code promo introuvable.' });
  const next = row.is_active ? 0 : 1;
  db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(next, id);
  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'COUPON_TOGGLED',
    entityType: 'coupon',
    entityId: row.code,
    details: { is_active: Boolean(next) },
    ipAddress: req.ip,
  });
  return res.json({ is_active: Boolean(next) });
});

adminRouter.get('/shipping', (_req, res) => {
  const db = getDb();
  const zones = db.prepare('SELECT * FROM shipping_settings ORDER BY id ASC').all();
  res.json({ zones });
});

adminRouter.put('/shipping/:id', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const feeMad = Math.max(0, Number(req.body?.fee_mad));
  const freeAboveMad = Math.max(0, Number(req.body?.free_above_mad));
  const estimatedDays = sanitizeText(req.body?.estimated_days, 40);
  const isActive = req.body?.is_active !== false ? 1 : 0;

  if (!Number.isFinite(feeMad) || !Number.isFinite(freeAboveMad)) {
    return res.status(400).json({ error: 'Tarifs de livraison invalides.' });
  }

  db.prepare(
    'UPDATE shipping_settings SET fee_mad = ?, free_above_mad = ?, estimated_days = ?, is_active = ? WHERE id = ?'
  ).run(feeMad, freeAboveMad, estimatedDays, isActive, id);

  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'SHIPPING_UPDATED',
    entityType: 'shipping_settings',
    entityId: id,
    details: { feeMad, freeAboveMad, estimatedDays },
    ipAddress: req.ip,
  });

  return res.json({ success: true });
});

adminRouter.get('/settings', (_req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 60').all();
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 50').all();
  res.json({ settings, auditLogs, messages });
});

adminRouter.put('/settings', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const b = req.body || {};
  const storeName = sanitizeText(b.store_name, 100);
  const logoText = sanitizeText(b.logo_text, 60);
  const slogan = sanitizeText(b.slogan, 200);
  const address = sanitizeText(b.address, 250);
  const phone = sanitizeText(b.phone, 50);
  const whatsapp = sanitizeText(b.whatsapp, 50);
  const instagram = sanitizeText(b.instagram, 80);
  const email = sanitizeText(b.email, 120);
  const currency = sanitizeText(b.currency, 10) || 'MAD';
  const termsText = sanitizeText(b.terms_text, 5000);
  const returnPolicyText = sanitizeText(b.return_policy_text, 5000);

  if (!storeName || !email) {
    return res.status(400).json({ error: 'Nom commercial et e-mail obligatoires.' });
  }

  db.prepare(
    `UPDATE store_settings
     SET store_name = ?, logo_text = ?, slogan = ?, address = ?, phone = ?, whatsapp = ?,
         instagram = ?, email = ?, currency = ?, terms_text = ?, return_policy_text = ?,
         updated_at = datetime('now')
     WHERE id = 1`
  ).run(storeName, logoText, slogan, address, phone, whatsapp, instagram, email, currency, termsText, returnPolicyText);

  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'STORE_SETTINGS_UPDATED',
    entityType: 'store_settings',
    entityId: 1,
    ipAddress: req.ip,
  });

  const updated = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
  return res.json({ settings: updated });
});

adminRouter.get('/backup', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const backup = {
    exportedAt: new Date().toISOString(),
    exportedBy: req.authUser!.username,
    categories: db.prepare('SELECT * FROM categories').all(),
    products: db.prepare('SELECT * FROM products').all(),
    product_images: db.prepare('SELECT * FROM product_images').all(),
    product_variants: db.prepare('SELECT * FROM product_variants').all(),
    customers: db.prepare('SELECT * FROM customers').all(),
    orders: db.prepare('SELECT * FROM orders').all(),
    order_items: db.prepare('SELECT * FROM order_items').all(),
    payments: db.prepare('SELECT * FROM payments').all(),
    promotions: db.prepare('SELECT * FROM promotions').all(),
    coupons: db.prepare('SELECT * FROM coupons').all(),
    shipping_settings: db.prepare('SELECT * FROM shipping_settings').all(),
    store_settings: db.prepare('SELECT * FROM store_settings').all(),
  };

  writeAuditLog(db, {
    actorUserId: req.authUser!.sub,
    actorUsername: req.authUser!.username,
    action: 'DATABASE_BACKUP_EXPORTED',
    entityType: 'system',
    ipAddress: req.ip,
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="casastyle-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  return res.send(JSON.stringify(backup, null, 2));
});
