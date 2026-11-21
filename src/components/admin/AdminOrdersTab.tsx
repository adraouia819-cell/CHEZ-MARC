import { useState } from 'react';
import { Eye, Printer, Search, X } from 'lucide-react';
import { apiFetch, formatMad } from '../../lib/api.ts';
import type { Order, StoreSettings } from '../../types/index.ts';

interface AdminOrdersTabProps {
  orders: Order[];
  statuses: string[];
  storeSettings: StoreSettings | null;
  onSearchChange: (q: string, status: string) => void;
  onRefresh: () => void;
}

export function AdminOrdersTab({
  orders,
  statuses,
  storeSettings,
  onSearchChange,
  onRefresh,
}: AdminOrdersTabProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleStatusChange = async (orderId: number, nextStatus: string) => {
    setFeedback('');
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedback(`Statut mis à jour vers "${nextStatus}".`);
      onRefresh();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Mise à jour impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-[#111111]">Gestion des Commandes</h2>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Suivi complet, synchronisation automatique des stocks et impression de factures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5A554E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearchChange(e.target.value, statusFilter);
              }}
              placeholder="N° commande, client, tél..."
              className="pl-9 pr-3 py-2 text-xs border border-[#D8CFC2] bg-white w-56 focus:outline-none focus:border-[#111111]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              onSearchChange(query, e.target.value);
            }}
            className="px-3 py-2 text-xs border border-[#D8CFC2] bg-white"
          >
            <option value="Tous">Tous les statuts</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 bg-[#F2ECE3] border border-[#D8CFC2] text-xs text-[#111111] flex justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E6DFD5] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E6DFD5] bg-[#F2ECE3]/60 text-[#5A554E] uppercase">
            <tr>
              <th className="py-3 px-4 font-medium">N° Commande</th>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Client & Téléphone</th>
              <th className="py-3 px-4 font-medium">Ville</th>
              <th className="py-3 px-4 font-medium text-right">Montant</th>
              <th className="py-3 px-4 font-medium">Statut</th>
              <th className="py-3 px-4 font-medium text-right">Détails / Facture</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6DFD5]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-[#FAF8F5]">
                <td className="py-3 px-4 font-mono font-semibold text-[#111111]">{order.order_number}</td>
                <td className="py-3 px-4 font-mono text-[#5A554E]">{order.created_at.slice(0, 10)}</td>
                <td className="py-3 px-4">
                  <div className="font-medium text-[#111111]">{order.customer_name}</div>
                  <div className="text-[#5A554E]">{order.customer_phone}</div>
                </td>
                <td className="py-3 px-4 text-[#5A554E]">{order.shipping_city}</td>
                <td className="py-3 px-4 text-right font-semibold text-[#111111] tabular-nums">
                  {formatMad(order.total_mad)}
                </td>
                <td className="py-3 px-4">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="px-2 py-1 text-xs border border-[#D8CFC2] bg-[#FAF8F5] text-[#111111]"
                  >
                    {statuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D8CFC2] text-[#111111] hover:border-[#111111] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Voir / Facture</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Detail & Printable Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/55 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6DFD5] w-full max-w-2xl p-6 lg:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-[#E6DFD5] pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#9A7D43]">{storeSettings?.store_name || 'CASA STYLE'}</p>
                <h3 className="font-display text-2xl text-[#111111] mt-1">
                  Facture / Bon de commande {selectedOrder.order_number}
                </h3>
                <p className="text-xs text-[#5A554E] mt-0.5">
                  Émise le {selectedOrder.created_at} · Statut : {selectedOrder.status}
                </p>
              </div>
              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#111111] text-white text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 text-[#5A554E] hover:text-[#111111] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <p className="font-semibold text-[#111111] uppercase mb-1">Client</p>
                <p className="font-medium text-[#111111]">{selectedOrder.customer_name}</p>
                <p className="text-[#5A554E]">{selectedOrder.customer_email}</p>
                <p className="text-[#5A554E]">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <p className="font-semibold text-[#111111] uppercase mb-1">Adresse de livraison</p>
                <p className="text-[#5A554E]">{selectedOrder.shipping_address}</p>
                <p className="text-[#5A554E]">
                  {selectedOrder.shipping_city} {selectedOrder.postal_code}
                </p>
                <p className="text-[#5A554E] mt-1">
                  Paiement : {selectedOrder.payment_method || 'COD'} ({selectedOrder.payment_status || 'En attente'})
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs border-t border-b border-[#E6DFD5]">
              <thead className="bg-[#FAF8F5] text-[#5A554E] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Article</th>
                  <th className="py-2.5 px-3">Variante</th>
                  <th className="py-2.5 px-3 text-right">Qté</th>
                  <th className="py-2.5 px-3 text-right">P.U.</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFD5] tabular-nums">
                {selectedOrder.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 px-3 font-medium text-[#111111]">{it.product_name}</td>
                    <td className="py-2.5 px-3 text-[#5A554E]">
                      {it.size} · {it.color_name}
                    </td>
                    <td className="py-2.5 px-3 text-right">{it.quantity}</td>
                    <td className="py-2.5 px-3 text-right">{formatMad(it.unit_price_mad)}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatMad(it.line_total_mad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col items-end space-y-1.5 text-xs tabular-nums">
              <div className="flex gap-8 text-[#5A554E]">
                <span>Sous-total :</span>
                <span>{formatMad(selectedOrder.subtotal_mad)}</span>
              </div>
              {selectedOrder.discount_mad > 0 && (
                <div className="flex gap-8 text-[#166534]">
                  <span>Remise ({selectedOrder.coupon_code}) :</span>
                  <span>-{formatMad(selectedOrder.discount_mad)}</span>
                </div>
              )}
              <div className="flex gap-8 text-[#5A554E]">
                <span>Livraison :</span>
                <span>{formatMad(selectedOrder.shipping_fee_mad)}</span>
              </div>
              <div className="flex gap-8 text-base font-semibold text-[#111111] pt-2 border-t border-[#E6DFD5]">
                <span>Total TTC :</span>
                <span>{formatMad(selectedOrder.total_mad)}</span>
              </div>
            </div>

            {storeSettings && (
              <p className="text-[11px] text-[#5A554E] border-t border-[#E6DFD5] pt-3">
                {storeSettings.store_name} · {storeSettings.address} · {storeSettings.phone} · {storeSettings.email}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
