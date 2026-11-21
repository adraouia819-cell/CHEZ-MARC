import { useState, type FormEvent } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { apiFetch, formatMad } from '../../lib/api.ts';
import type { Category, Product } from '../../types/index.ts';
import { StudioImage } from '../StudioImage.tsx';

interface AdminProductsTabProps {
  products: Product[];
  categories: Category[];
  onRefresh: () => void;
}

const STUDIO_GALLERY_PRESETS = [
  '/src/assets/images/product_blazer_noir_1795271383188.jpg',
  '/src/assets/images/product_trench_sable_1795271382596.jpg',
  '/src/assets/images/product_robe_soie_1795271382520.jpg',
  '/src/assets/images/product_chemise_lin_1795271382448.jpg',
  '/src/assets/images/product_sac_cuir_1795271382806.jpg',
  '/src/assets/images/product_mocassins_daim_1795271383329.jpg',
  '/src/assets/images/hero_casa_editorial_1795271381879.jpg',
];

interface DraftVariant {
  id?: number;
  size: string;
  color_name: string;
  color_hex: string;
  stock_qty: number;
}

export function AdminProductsTab({ products, categories, onRefresh }: AdminProductsTabProps) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [priceMad, setPriceMad] = useState('');
  const [promoPriceMad, setPromoPriceMad] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [gender, setGender] = useState<'femme' | 'homme' | 'accessoires' | 'mixte'>('femme');
  const [material, setMaterial] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([STUDIO_GALLERY_PRESETS[0]]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([
    { size: 'M', color_name: 'Noir Obsidienne', color_hex: '#111111', stock_qty: 10 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const openCreate = () => {
    setEditing(null);
    setIsCreating(true);
    setName('');
    setSku(`CS-${Date.now().toString().slice(-4)}`);
    setDescription('');
    setPriceMad('1990');
    setPromoPriceMad('');
    setCategoryId(categories[0]?.id || 1);
    setGender('femme');
    setMaterial('');
    setCareInstructions('');
    setIsActive(true);
    setIsFeatured(true);
    setImageUrls([STUDIO_GALLERY_PRESETS[0]]);
    setVariants([
      { size: 'S', color_name: 'Noir Obsidienne', color_hex: '#111111', stock_qty: 5 },
      { size: 'M', color_name: 'Noir Obsidienne', color_hex: '#111111', stock_qty: 8 },
    ]);
    setError('');
  };

  const openEdit = (p: Product) => {
    setIsCreating(false);
    setEditing(p);
    setName(p.name);
    setSku(p.sku);
    setDescription(p.description);
    setPriceMad(String(p.price_mad));
    setPromoPriceMad(p.promo_price_mad !== null ? String(p.promo_price_mad) : '');
    setCategoryId(p.category_id);
    setGender(p.gender);
    setMaterial(p.material || '');
    setCareInstructions(p.care_instructions || '');
    setIsActive(p.is_active);
    setIsFeatured(p.is_featured);
    setImageUrls(p.images.map((i) => i.image_url));
    setVariants(
      p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color_name: v.color_name,
        color_hex: v.color_hex,
        stock_qty: v.stock_qty,
      }))
    );
    setError('');
  };

  const closeModal = () => {
    setEditing(null);
    setIsCreating(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name,
        sku,
        description,
        price_mad: Number(priceMad),
        promo_price_mad: promoPriceMad ? Number(promoPriceMad) : null,
        category_id: Number(categoryId),
        gender,
        material,
        care_instructions: careInstructions,
        is_active: isActive,
        is_featured: isFeatured,
        images: imageUrls.filter(Boolean).map((url, idx) => ({ image_url: url, is_primary: idx === 0 })),
        variants,
      };

      if (editing) {
        await apiFetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback('Produit mis à jour.');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('Nouveau produit créé.');
      }
      closeModal();
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    try {
      const res = await apiFetch<{ archived?: boolean; message?: string }>(`/api/admin/products/${p.id}`, {
        method: 'DELETE',
      });
      setFeedback(res.message || `Produit "${p.name}" supprimé.`);
      onRefresh();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  };

  const toggleProductFlag = async (p: Product, field: 'is_active' | 'is_featured') => {
    try {
      await apiFetch(`/api/admin/products/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: p.name,
          sku: p.sku,
          description: p.description,
          price_mad: p.price_mad,
          promo_price_mad: p.promo_price_mad,
          category_id: p.category_id,
          gender: p.gender,
          material: p.material,
          care_instructions: p.care_instructions,
          is_active: field === 'is_active' ? !p.is_active : p.is_active,
          is_featured: field === 'is_featured' ? !p.is_featured : p.is_featured,
        }),
      });
      onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-[#111111]">Catalogue & Gestion des Stocks</h2>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Toute modification est répercutée instantanément sur la boutique publique.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-[#FAF8F5] text-xs font-medium tracking-wider uppercase hover:bg-[#2A2622] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un produit</span>
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 bg-[#F2ECE3] border border-[#D8CFC2] text-xs text-[#111111] flex justify-between items-center">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="text-[#5A554E] cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E6DFD5] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E6DFD5] bg-[#F2ECE3]/60 text-[#5A554E] uppercase">
            <tr>
              <th className="py-3 px-4 font-medium">Produit</th>
              <th className="py-3 px-4 font-medium">SKU</th>
              <th className="py-3 px-4 font-medium">Catégorie</th>
              <th className="py-3 px-4 font-medium text-right">Prix</th>
              <th className="py-3 px-4 font-medium text-right">Stock total</th>
              <th className="py-3 px-4 font-medium text-center">Statut</th>
              <th className="py-3 px-4 font-medium text-center">Vedette</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6DFD5]">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-[#FAF8F5]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F2ECE3] border border-[#E6DFD5] shrink-0 overflow-hidden">
                      <StudioImage src={p.images[0]?.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-semibold text-[#111111]">{p.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-[#5A554E]">{p.sku}</td>
                <td className="py-3 px-4 text-[#5A554E]">{p.category_name}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {p.promo_price_mad ? (
                    <div>
                      <span className="font-semibold text-[#111111]">{formatMad(p.promo_price_mad)}</span>
                      <span className="block text-[11px] line-through text-[#5A554E]">{formatMad(p.price_mad)}</span>
                    </div>
                  ) : (
                    <span className="font-semibold text-[#111111]">{formatMad(p.price_mad)}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span className={p.total_stock === 0 ? 'text-[#991B1B] font-semibold' : 'text-[#111111] font-medium'}>
                    {p.total_stock}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => toggleProductFlag(p, 'is_active')}
                    className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer ${
                      p.is_active
                        ? 'border-[#166534]/30 bg-[#DCFCE7] text-[#166534]'
                        : 'border-[#D8CFC2] bg-[#F2ECE3] text-[#5A554E]'
                    }`}
                  >
                    {p.is_active ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => toggleProductFlag(p, 'is_featured')}
                    className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer ${
                      p.is_featured
                        ? 'border-[#9A7D43] bg-[#B89B5E]/15 text-[#9A7D43]'
                        : 'border-[#E6DFD5] text-[#5A554E]'
                    }`}
                  >
                    {p.is_featured ? 'Vedette' : 'Standard'}
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-[#111111] hover:text-[#9A7D43] cursor-pointer"
                      aria-label={`Modifier ${p.name}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="p-1.5 text-[#5A554E] hover:text-[#991B1B] cursor-pointer"
                      aria-label={`Supprimer ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Product Modal */}
      {(isCreating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6DFD5] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-4">
              <h3 className="font-display text-2xl text-[#111111]">
                {editing ? `Modifier : ${editing.name}` : 'Nouveau produit CASA STYLE'}
              </h3>
              <button type="button" onClick={closeModal} className="p-1 text-[#5A554E] hover:text-[#111111] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#111111] mb-1">Nom du produit *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Référence SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Prix (MAD) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={priceMad}
                    onChange={(e) => setPriceMad(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Prix promo (MAD)</label>
                  <input
                    type="number"
                    min={0}
                    value={promoPriceMad}
                    onChange={(e) => setPromoPriceMad(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Catégorie</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Univers</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'femme' | 'homme' | 'accessoires' | 'mixte')}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  >
                    <option value="femme">Femme</option>
                    <option value="homme">Homme</option>
                    <option value="accessoires">Accessoires</option>
                    <option value="mixte">Mixte</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#111111] mb-1">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Matière</label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111111] mb-1">Conseils d’entretien</label>
                  <input
                    type="text"
                    value={careInstructions}
                    onChange={(e) => setCareInstructions(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                </div>
              </div>

              {/* Multi-Images Section */}
              <div className="border-t border-[#E6DFD5] pt-4 space-y-3">
                <label className="block font-semibold text-[#111111]">Photographies du produit</label>
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative w-16 h-16 border border-[#D8CFC2] bg-[#F2ECE3]">
                      <StudioImage src={url} alt="Aperçu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#111111] text-white flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="URL d'image ou choisir ci-dessous..."
                    className="flex-1 px-3 py-2 border border-[#D8CFC2] bg-[#FAF8F5]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newImageUrl.trim()) {
                        setImageUrls([...imageUrls, newImageUrl.trim()]);
                        setNewImageUrl('');
                      }
                    }}
                    className="px-4 py-2 border border-[#111111] font-medium cursor-pointer"
                  >
                    Ajouter URL
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_GALLERY_PRESETS.map((preset, i) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setImageUrls([...imageUrls, preset])}
                      className="px-2 py-1 border border-[#D8CFC2] bg-[#FAF8F5] hover:border-[#111111] cursor-pointer"
                    >
                      + Studio {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variants & Stock Matrix */}
              <div className="border-t border-[#E6DFD5] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#111111]">Tailles, Couleurs & Quantités en stock *</label>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants([
                        ...variants,
                        { size: 'L', color_name: 'Beige Sable', color_hex: '#D6C7B2', stock_qty: 5 },
                      ])
                    }
                    className="text-[#9A7D43] font-medium hover:underline cursor-pointer"
                  >
                    + Ajouter une variante
                  </button>
                </div>

                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Taille"
                        value={v.size}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...next[idx], size: e.target.value };
                          setVariants(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                      <input
                        type="text"
                        placeholder="Couleur"
                        value={v.color_name}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...next[idx], color_name: e.target.value };
                          setVariants(next);
                        }}
                        className="col-span-4 px-2.5 py-1.5 border border-[#D8CFC2] bg-[#FAF8F5]"
                      />
                      <input
                        type="color"
                        value={v.color_hex}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...next[idx], color_hex: e.target.value };
                          setVariants(next);
                        }}
                        className="col-span-1 h-8 w-full border border-[#D8CFC2] cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Stock"
                        value={v.stock_qty}
                        onChange={(e) => {
                          const next = [...variants];
                          next[idx] = { ...next[idx], stock_qty: Math.max(0, Number(e.target.value)) };
                          setVariants(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 border border-[#D8CFC2] bg-[#FAF8F5] tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                        className="col-span-1 text-[#5A554E] hover:text-[#991B1B] cursor-pointer text-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span>Produit actif en boutique</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span>Mettre en vedette sur l’accueil</span>
                </label>
              </div>

              {error && <p className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">{error}</p>}

              <div className="flex justify-end gap-3 pt-4 border-t border-[#E6DFD5]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 border border-[#D8CFC2] text-[#111111] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#111111] text-[#FAF8F5] font-medium uppercase tracking-wider cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
