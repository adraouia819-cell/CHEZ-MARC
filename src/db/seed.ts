import type { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../server/security.ts';

// Pre-computed scrypt hash for initial dev bootstrap (plaintext is never stored in source code).
const DEV_BOOTSTRAP_ADMIN_HASH =
  'scrypt$feb6680adfe3a52597b8716c6f770376$4194eb9be43559fef317f8c50bb929d7689c3fab84c4cf240be097f0f246f7788157bff3442968e626a453bb6d865c438b9f8c30026cbb3296ae3117938387d3';

export function seedDatabase(db: DatabaseSync): void {
  // 1. Roles
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  if (roleCount.count === 0) {
    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    insertRole.run('admin', 'Administrateur principal avec accès complet');
    insertRole.run('manager', 'Gestionnaire catalogue et commandes');
    insertRole.run('customer', 'Client enregistré de la boutique');
  }

  // 2. Secure initial admin bootstrap (only if no admin exists yet)
  const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get() as { id: number };
  const existingAdmin = db
    .prepare('SELECT id FROM users WHERE role_id = ? LIMIT 1')
    .get(adminRole.id) as { id: number } | undefined;

  if (!existingAdmin) {
    const adminUsername = process.env.ADMIN_INIT_USERNAME || 'admin';
    const envPassword = process.env.ADMIN_INIT_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !envPassword) {
      throw new Error('ADMIN_INIT_PASSWORD doit être défini en production pour initialiser le compte administrateur.');
    }

    const passwordHash = envPassword ? hashPassword(envPassword) : DEV_BOOTSTRAP_ADMIN_HASH;
    const mustChange = envPassword ? 0 : 1;

    db.prepare(
      `INSERT INTO users (username, email, password_hash, role_id, full_name, phone, must_change_password, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      adminUsername,
      'direction@casastyle.ma',
      passwordHash,
      adminRole.id,
      'Direction CASA STYLE',
      '+212 522 48 90 12',
      mustChange
    );
  }

  // 3. Store settings
  const storeExists = db.prepare('SELECT id FROM store_settings WHERE id = 1').get();
  if (!storeExists) {
    db.prepare(
      `INSERT INTO store_settings (
        id, store_name, logo_text, slogan, address, phone, whatsapp, instagram, email, currency, terms_text, return_policy_text
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'CASA STYLE',
      'CASA STYLE',
      'Votre style, votre identité.',
      '24 Boulevard d’Anfa, Quartier Racine, 20050 Casablanca, Maroc',
      '+212 522 48 90 12',
      '+212 661 48 90 12',
      '@casastyle.atelier',
      'bonjour@casastyle.ma',
      'MAD',
      'Les présentes conditions générales régissent l’ensemble des commandes passées sur la boutique CASA STYLE. Tous les prix sont exprimés en Dirhams Marocains (MAD) toutes taxes comprises. Le règlement s’effectue à la livraison après vérification de votre colis.',
      'Vous disposez d’un délai de 14 jours à compter de la réception de votre commande pour demander un échange de taille ou un retour sans frais à Casablanca et sous 48h dans tout le Maroc. Les pièces doivent être non portées, avec étiquettes d’origine et emballage CASA STYLE intact.'
    );
  }

  // 4. Shipping settings
  const shippingCount = db.prepare('SELECT COUNT(*) as count FROM shipping_settings').get() as { count: number };
  if (shippingCount.count === 0) {
    const insertShipping = db.prepare(
      'INSERT INTO shipping_settings (zone_name, city_pattern, fee_mad, free_above_mad, estimated_days, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    );
    insertShipping.run('Casablanca & Grand Casablanca', 'casablanca,mohammedia,bouskoura,dar bouazza', 30, 1500, '24h ouvrées');
    insertShipping.run('Axes Principaux (Rabat, Marrakech, Tanger)', 'rabat,sale,marrakech,tanger,kenitra,fes,meknes,agadir', 45, 2000, '24h - 48h');
    insertShipping.run('Autres Villes du Maroc', '*', 55, 2500, '48h - 72h');
  }

  // 5. Categories
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (categoryCount.count === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, gender, description, display_order) VALUES (?, ?, ?, ?, ?)'
    );
    insertCat.run('Tailoring & Manteaux Femme', 'femme-tailoring', 'femme', 'Coupes structurées et matières nobles pour femme.', 1);
    insertCat.run('Robes & Soie', 'femme-robes', 'femme', 'Silhouettes fluides en soie naturelle et satin.', 2);
    insertCat.run('Prêt-à-Porter Homme', 'homme-pret-a-porter', 'homme', 'Vestes, chemises en lin et essentiels masculins.', 3);
    insertCat.run('Maroquinerie & Souliers', 'accessoires-cuir', 'accessoires', 'Sacs en cuir pleine fleur et mocassins artisanaux.', 4);
  }

  // 6. Demo Products (clearly flagged as authentic starter catalog)
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const cats = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>;
    const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    const insertProd = db.prepare(
      `INSERT INTO products (
        name, slug, sku, description, price_mad, promo_price_mad, category_id, gender, material, care_instructions, is_active, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    );
    const insertImg = db.prepare(
      'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    const insertVar = db.prepare(
      'INSERT INTO product_variants (product_id, size, color_name, color_hex, stock_qty, sku_variant) VALUES (?, ?, ?, ?, ?, ?)'
    );

    // Product 1: Blazer Noir Tailored
    const p1 = insertProd.run(
      'Blazer Croisé Anfa Laine Vierge',
      'blazer-croise-anfa-laine-vierge',
      'CS-BLZ-001',
      'Taillé avec précision dans une laine vierge froide d’une tenue irréprochable, le blazer Anfa s’orne de boutons en laiton brossé doré et d’une doublure en viscose respirante. Pensé pour accompagner les journées casablancaises du matin jusqu’au soir.',
      2490,
      2150,
      catMap['homme-pret-a-porter'],
      'homme',
      '100% Laine Vierge Super 120s — Doublure 100% Cupro',
      'Nettoyage à sec délicat uniquement. Repassage vapeur douce.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p1, '/src/assets/images/product_blazer_noir_1795271383188.jpg', 'Blazer Croisé Anfa Noir vue studio', 1, 1);
    insertImg.run(p1, '/src/assets/images/hero_casa_editorial_1795271381879.jpg', 'Silhouette complète Anfa en éditorial Casablanca', 0, 2);
    insertVar.run(p1, 'S', 'Noir Obsidienne', '#111111', 6, 'CS-BLZ-001-S-NOI');
    insertVar.run(p1, 'M', 'Noir Obsidienne', '#111111', 12, 'CS-BLZ-001-M-NOI');
    insertVar.run(p1, 'L', 'Noir Obsidienne', '#111111', 8, 'CS-BLZ-001-L-NOI');
    insertVar.run(p1, 'XL', 'Noir Obsidienne', '#111111', 4, 'CS-BLZ-001-XL-NOI');

    // Product 2: Trench Sable
    const p2 = insertProd.run(
      'Trench Architectural Racine Gabardine',
      'trench-architectural-racine-gabardine',
      'CS-TRN-002',
      'Confectionné dans une gabardine de coton déperlante tissée serrée, ce trench long offre un tombé net et structuré. Ceinture amovible à boucle ton sur ton, bavolet tempête et finitions surpiquées à la main.',
      2890,
      null,
      catMap['femme-tailoring'],
      'femme',
      '100% Coton Gabardine Haute Densité',
      'Nettoyage à sec recommandé. Imperméabilisation durable.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p2, '/src/assets/images/product_trench_sable_1795271382596.jpg', 'Trench Architectural Sable vue face', 1, 1);
    insertImg.run(p2, '/src/assets/images/hero_casa_editorial_1795271381879.jpg', 'Ambiance architecturale CASA STYLE', 0, 2);
    insertVar.run(p2, 'XS', 'Sable Doré', '#D6C7B2', 3, 'CS-TRN-002-XS-SAB');
    insertVar.run(p2, 'S', 'Sable Doré', '#D6C7B2', 9, 'CS-TRN-002-S-SAB');
    insertVar.run(p2, 'M', 'Sable Doré', '#D6C7B2', 11, 'CS-TRN-002-M-SAB');
    insertVar.run(p2, 'L', 'Sable Doré', '#D6C7B2', 5, 'CS-TRN-002-L-SAB');

    // Product 3: Robe Soie Ivoire
    const p3 = insertProd.run(
      'Robe Midi Drapée Soie Corniche',
      'robe-midi-drapee-soie-corniche',
      'CS-ROB-003',
      'Une silhouette sculpturale en satin de soie lourde, animée par un drapé asymétrique à la taille qui sublime le mouvement. Col bateau épuré et manches longues fluides pour les dîners et réceptions.',
      3200,
      2790,
      catMap['femme-robes'],
      'femme',
      '100% Soie de Mûrier 22 Momme',
      'Nettoyage à sec exclusif. Ne pas tordre.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p3, '/src/assets/images/product_robe_soie_1795271382520.jpg', 'Robe Midi Drapée Soie Ivoire', 1, 1);
    insertImg.run(p3, '/src/assets/images/hero_casa_editorial_1795271381879.jpg', 'Robe portée en lumière dorée', 0, 2);
    insertVar.run(p3, 'XS', 'Ivoire Champagne', '#F3EDE0', 4, 'CS-ROB-003-XS-IVO');
    insertVar.run(p3, 'S', 'Ivoire Champagne', '#F3EDE0', 7, 'CS-ROB-003-S-IVO');
    insertVar.run(p3, 'M', 'Ivoire Champagne', '#F3EDE0', 6, 'CS-ROB-003-M-IVO');
    insertVar.run(p3, 'L', 'Noir Obsidienne', '#111111', 2, 'CS-ROB-003-L-NOI');

    // Product 4: Surchemise Lin Écru
    const p4 = insertProd.run(
      'Surchemise Lin Atlantique Écru',
      'surchemise-lin-atlantique-ecru',
      'CS-CHM-004',
      'Tissée dans un lin européen épais lavé aux enzymes pour un toucher souple dès le premier port. Double poche poitrine à rabat et boutons en nacre naturelle gravés.',
      1190,
      null,
      catMap['homme-pret-a-porter'],
      'homme',
      '100% Lin Naturel Lourd 240g/m²',
      'Lavage à 30°C cycle délicat. Séchage à plat.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p4, '/src/assets/images/product_chemise_lin_1795271382448.jpg', 'Surchemise Lin Écru détail col et boutons', 1, 1);
    insertVar.run(p4, 'S', 'Écru Naturel', '#F7F3EA', 8, 'CS-CHM-004-S-ECR');
    insertVar.run(p4, 'M', 'Écru Naturel', '#F7F3EA', 14, 'CS-CHM-004-M-ECR');
    insertVar.run(p4, 'L', 'Écru Naturel', '#F7F3EA', 10, 'CS-CHM-004-L-ECR');
    insertVar.run(p4, 'XL', 'Beige Sable', '#CBBBA0', 5, 'CS-CHM-004-XL-SAB');

    // Product 5: Sac Cuir Structuré
    const p5 = insertProd.run(
      'Sac Structuré Mazagan Cuir Grainé',
      'sac-structure-mazagan-cuir-graine',
      'CS-SAC-005',
      'Sac à main géométrique en cuir de veau pleine fleur grainé, rehaussé d’un fermoir bijou en laiton doré mat. Livré avec bandoulière réglable amovible et pochon en coton bio.',
      3450,
      null,
      catMap['accessoires-cuir'],
      'accessoires',
      '100% Cuir de Veau Pleine Fleur — Doublure Suédine',
      'Nourrir avec un baume cuir incolore. Conserver dans sa housse.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p5, '/src/assets/images/product_sac_cuir_1795271382806.jpg', 'Sac Structuré Mazagan Cuir Noir', 1, 1);
    insertVar.run(p5, 'Unique', 'Noir Obsidienne', '#111111', 7, 'CS-SAC-005-U-NOI');
    insertVar.run(p5, 'Unique', 'Beige Travertin', '#D6C7B2', 3, 'CS-SAC-005-U-BEI');

    // Product 6: Mocassins Daim (inclus une rupture pour démontrer l'indicateur stock réel)
    const p6 = insertProd.run(
      'Mocassins Cousu Blake Daim Sable',
      'mocassins-cousu-blake-daim-sable',
      'CS-MOC-006',
      'Confectionnés artisanalement en veau velours hydrofuge sur une semelle cuir cousu Blake avec patin antidérapant. Détail boucle latérale dorée discrète.',
      1890,
      1650,
      catMap['accessoires-cuir'],
      'accessoires',
      '100% Veau Velours Italien — Semelle Cuir',
      'Brosser délicatement avec une brosse crêpe.',
      1
    ).lastInsertRowid as number;
    insertImg.run(p6, '/src/assets/images/product_mocassins_daim_1795271383329.jpg', 'Mocassins Daim Sable sur travertin', 1, 1);
    insertVar.run(p6, '40', 'Sable Chaud', '#C7B299', 4, 'CS-MOC-006-40-SAB');
    insertVar.run(p6, '41', 'Sable Chaud', '#C7B299', 6, 'CS-MOC-006-41-SAB');
    insertVar.run(p6, '42', 'Sable Chaud', '#C7B299', 5, 'CS-MOC-006-42-SAB');
    insertVar.run(p6, '43', 'Sable Chaud', '#C7B299', 0, 'CS-MOC-006-43-SAB');

    // Product 7 (Rupture complète pour illustrer le KPI "Produits en rupture de stock")
    const p7 = insertProd.run(
      'Manteau Long Cachemire Mélangé Gauthier',
      'manteau-long-cachemire-gauthier',
      'CS-MNT-007',
      'Manteau croisé coupe droite en drap de laine et cachemire, col tailleur généreux et fente d’aisance arrière. Édition limitée saison automne-hiver.',
      3950,
      null,
      catMap['femme-tailoring'],
      'femme',
      '80% Laine Vierge, 20% Cachemire',
      'Nettoyage à sec spécialisé.',
      0
    ).lastInsertRowid as number;
    insertImg.run(p7, '/src/assets/images/product_trench_sable_1795271382596.jpg', 'Manteau Long Cachemire', 1, 1);
    insertVar.run(p7, 'S', 'Beige Camel', '#C4A986', 0, 'CS-MNT-007-S-CAM');
    insertVar.run(p7, 'M', 'Beige Camel', '#C4A986', 0, 'CS-MNT-007-M-CAM');

    // 7. Promotions & Coupons
    const promoId = db
      .prepare(
        `INSERT INTO promotions (name, description, discount_type, discount_value, start_date, end_date, is_active, product_ids_json)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        'Ouverture Saison Casablanca',
        'Remise privilège de bienvenue sur la collection signature.',
        'percentage',
        15,
        '2025-01-01',
        '2027-12-31',
        JSON.stringify([p1, p3, p6])
      ).lastInsertRowid as number;

    db.prepare(
      `INSERT INTO coupons (code, promotion_id, discount_type, discount_value, min_order_mad, max_uses, uses_count, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run('CASA15', promoId, 'percentage', 15, 1000, 500, 3, '2025-01-01', '2027-12-31');

    db.prepare(
      `INSERT INTO coupons (code, promotion_id, discount_type, discount_value, min_order_mad, max_uses, uses_count, start_date, end_date, is_active)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run('ANFA200', 'fixed', 200, 1800, 200, 1, '2025-01-01', '2027-12-31');

    // 8. Demo Customers & Real Historical Orders (for real DB analytics & charts)
    const customerRole = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get() as { id: number };
    const demoUserId = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, role_id, full_name, phone, must_change_password, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
      )
      .run('salma.bennani', 'salma.bennani@example.ma', hashPassword('ClientCasa2026!'), customerRole.id, 'Salma Bennani', '+212 661 23 45 67')
      .lastInsertRowid as number;

    const insertCust = db.prepare(
      `INSERT INTO customers (user_id, full_name, email, phone, city, address, postal_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const c1 = insertCust.run(demoUserId, 'Salma Bennani', 'salma.bennani@example.ma', '+212 661 23 45 67', 'Casablanca', '18 Rue Jean Jaurès, Quartier Gautier', '20000', 'Cliente fidèle Casablanca').lastInsertRowid as number;
    const c2 = insertCust.run(null, 'Youssef El Amrani', 'youssef.amrani@example.ma', '+212 662 98 11 04', 'Rabat', '45 Avenue Mohammed VI, Souissi', '10170', '').lastInsertRowid as number;
    const c3 = insertCust.run(null, 'Kenza Tazi', 'kenza.tazi@example.ma', '+212 664 55 72 19', 'Marrakech', '12 Résidence Les Oliviers, Guéliz', '40000', '').lastInsertRowid as number;
    const c4 = insertCust.run(null, 'Mehdi Berrada', 'mehdi.berrada@example.ma', '+212 661 77 30 88', 'Casablanca', '9 Boulevard Massira Al Khadra, Maarif', '20100', '').lastInsertRowid as number;

    const insertOrder = db.prepare(
      `INSERT INTO orders (
        order_number, customer_id, customer_name, customer_email, customer_phone, shipping_city, shipping_address, postal_code,
        status, subtotal_mad, discount_mad, shipping_fee_mad, total_mad, coupon_code, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name, sku, size, color_name, unit_price_mad, quantity, line_total_mad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPay = db.prepare(
      `INSERT INTO payments (order_id, method, status, amount_mad, currency, provider, created_at)
       VALUES (?, 'COD', ?, ?, 'MAD', 'cash_on_delivery', ?)`
    );

    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    const seedOrders = [
      {
        num: 'CS-2026-1001', custId: c1, name: 'Salma Bennani', email: 'salma.bennani@example.ma', phone: '+212 661 23 45 67',
        city: 'Casablanca', addr: '18 Rue Jean Jaurès, Gautier', zip: '20000', status: 'Livrée', payStatus: 'Payé',
        sub: 2790, disc: 0, ship: 0, tot: 2790, coupon: '', date: daysAgo(18),
        items: [{ pid: p3, pname: 'Robe Midi Drapée Soie Corniche', sku: 'CS-ROB-003', size: 'S', color: 'Ivoire Champagne', price: 2790, qty: 1 }],
      },
      {
        num: 'CS-2026-1002', custId: c2, name: 'Youssef El Amrani', email: 'youssef.amrani@example.ma', phone: '+212 662 98 11 04',
        city: 'Rabat', addr: '45 Avenue Mohammed VI, Souissi', zip: '10170', status: 'Livrée', payStatus: 'Payé',
        sub: 3340, disc: 200, ship: 0, tot: 3140, coupon: 'ANFA200', date: daysAgo(11),
        items: [
          { pid: p1, pname: 'Blazer Croisé Anfa Laine Vierge', sku: 'CS-BLZ-001', size: 'M', color: 'Noir Obsidienne', price: 2150, qty: 1 },
          { pid: p4, pname: 'Surchemise Lin Atlantique Écru', sku: 'CS-CHM-004', size: 'M', color: 'Écru Naturel', price: 1190, qty: 1 },
        ],
      },
      {
        num: 'CS-2026-1003', custId: c3, name: 'Kenza Tazi', email: 'kenza.tazi@example.ma', phone: '+212 664 55 72 19',
        city: 'Marrakech', addr: '12 Résidence Les Oliviers, Guéliz', zip: '40000', status: 'Expédiée', payStatus: 'En attente',
        sub: 3450, disc: 0, ship: 0, tot: 3450, coupon: '', date: daysAgo(5),
        items: [{ pid: p5, pname: 'Sac Structuré Mazagan Cuir Grainé', sku: 'CS-SAC-005', size: 'Unique', color: 'Noir Obsidienne', price: 3450, qty: 1 }],
      },
      {
        num: 'CS-2026-1004', custId: c4, name: 'Mehdi Berrada', email: 'mehdi.berrada@example.ma', phone: '+212 661 77 30 88',
        city: 'Casablanca', addr: '9 Boulevard Massira Al Khadra, Maarif', zip: '20100', status: 'En préparation', payStatus: 'En attente',
        sub: 1650, disc: 247.5, ship: 30, tot: 1432.5, coupon: 'CASA15', date: daysAgo(2),
        items: [{ pid: p6, pname: 'Mocassins Cousu Blake Daim Sable', sku: 'CS-MOC-006', size: '42', color: 'Sable Chaud', price: 1650, qty: 1 }],
      },
      {
        num: 'CS-2026-1005', custId: c1, name: 'Salma Bennani', email: 'salma.bennani@example.ma', phone: '+212 661 23 45 67',
        city: 'Casablanca', addr: '18 Rue Jean Jaurès, Gautier', zip: '20000', status: 'Nouvelle commande', payStatus: 'En attente',
        sub: 2890, disc: 0, ship: 0, tot: 2890, coupon: '', date: daysAgo(0),
        items: [{ pid: p2, pname: 'Trench Architectural Racine Gabardine', sku: 'CS-TRN-002', size: 'M', color: 'Sable Doré', price: 2890, qty: 1 }],
      },
    ];

    for (const o of seedOrders) {
      const oid = insertOrder.run(
        o.num, o.custId, o.name, o.email, o.phone, o.city, o.addr, o.zip,
        o.status, o.sub, o.disc, o.ship, o.tot, o.coupon, '', o.date, o.date
      ).lastInsertRowid as number;
      for (const it of o.items) {
        insertItem.run(oid, it.pid, null, it.pname, it.sku, it.size, it.color, it.price, it.qty, it.price * it.qty);
      }
      insertPay.run(oid, o.payStatus, o.tot, o.date);
    }
  }
}
