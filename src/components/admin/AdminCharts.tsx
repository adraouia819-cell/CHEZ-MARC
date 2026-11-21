import { formatMad } from '../../lib/api.ts';

interface DailyPoint {
  day: string;
  orders_count: number;
  revenue_mad: number;
}

interface MonthlyPoint {
  month: string;
  orders_count: number;
  revenue_mad: number;
}

interface TopProductPoint {
  product_name: string;
  sku: string;
  units_sold: number;
  revenue_mad: number;
}

interface StatusPoint {
  status: string;
  count: number;
  revenue_mad: number;
}

interface AdminChartsProps {
  dailySales: DailyPoint[];
  monthlySales: MonthlyPoint[];
  topProducts: TopProductPoint[];
  ordersByStatus: StatusPoint[];
}

export function AdminCharts({ dailySales, monthlySales, topProducts, ordersByStatus }: AdminChartsProps) {
  const maxDailyRev = Math.max(...dailySales.map((d) => d.revenue_mad), 1);
  const maxMonthlyRev = Math.max(...monthlySales.map((m) => m.revenue_mad), 1);
  const maxUnits = Math.max(...topProducts.map((p) => p.units_sold), 1);
  const totalOrdersStatus = Math.max(ordersByStatus.reduce((s, r) => s + r.count, 0), 1);

  // Build SVG polyline for revenue evolution
  const chartW = 520;
  const chartH = 160;
  const points = dailySales.map((d, i) => {
    const x = dailySales.length === 1 ? chartW / 2 : (i / (dailySales.length - 1)) * (chartW - 40) + 20;
    const y = chartH - 20 - (d.revenue_mad / maxDailyRev) * (chartH - 40);
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${chartH - 20} L ${points[0].x.toFixed(1)} ${chartH - 20} Z`
      : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Évolution du CA & Ventes Quotidiennes */}
      <div className="bg-white border border-[#E6DFD5] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#111111]">Évolution du chiffre d’affaires & ventes quotidiennes</h3>
            <p className="text-xs text-[#5A554E] mt-0.5">Commandes validées des 30 derniers jours</p>
          </div>
        </div>

        {dailySales.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#5A554E]">Aucune vente enregistrée sur la période.</p>
        ) : (
          <div className="space-y-4">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="casaRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B89B5E" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#B89B5E" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="20" y1={chartH - 20} x2={chartW - 20} y2={chartH - 20} stroke="#E6DFD5" strokeWidth="1" />
              <line x1="20" y1="20" x2={chartW - 20} y2="20" stroke="#F2ECE3" strokeDasharray="3 3" strokeWidth="1" />
              {areaPath && <path d={areaPath} fill="url(#casaRevGrad)" />}
              {linePath && <path d={linePath} fill="none" stroke="#111111" strokeWidth="2" />}
              {points.map((pt) => (
                <g key={pt.day}>
                  <circle cx={pt.x} cy={pt.y} r="4" fill="#B89B5E" stroke="#111111" strokeWidth="1.5">
                    <title>{`${pt.day} : ${formatMad(pt.revenue_mad)} (${pt.orders_count} cmd)`}</title>
                  </circle>
                  <text x={pt.x} y={chartH - 4} textAnchor="middle" className="fill-[#5A554E] text-[9px] font-mono">
                    {pt.day.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F2ECE3] text-xs tabular-nums">
              {dailySales.slice(-3).map((d) => (
                <div key={d.day}>
                  <p className="text-[#5A554E] font-mono">{d.day}</p>
                  <p className="font-semibold text-[#111111]">{formatMad(d.revenue_mad)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Ventes Mensuelles */}
      <div className="bg-white border border-[#E6DFD5] p-6">
        <h3 className="text-sm font-semibold text-[#111111]">Ventes mensuelles</h3>
        <p className="text-xs text-[#5A554E] mt-0.5 mb-5">Chiffre d’affaires et volume par mois</p>

        {monthlySales.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#5A554E]">Aucune donnée mensuelle.</p>
        ) : (
          <div className="space-y-3">
            {monthlySales.map((m) => {
              const pct = Math.max(6, Math.round((m.revenue_mad / maxMonthlyRev) * 100));
              return (
                <div key={m.month} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="font-mono text-[#111111]">{m.month}</span>
                    <span className="text-[#5A554E]">
                      {m.orders_count} cmd · <strong className="text-[#111111]">{formatMad(m.revenue_mad)}</strong>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#F2ECE3] overflow-hidden">
                    <div className="h-full bg-[#111111]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Produits les plus vendus */}
      <div className="bg-white border border-[#E6DFD5] p-6">
        <h3 className="text-sm font-semibold text-[#111111]">Produits les plus vendus</h3>
        <p className="text-xs text-[#5A554E] mt-0.5 mb-5">Classement par quantités commandées</p>

        {topProducts.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#5A554E]">Aucune vente enregistrée.</p>
        ) : (
          <div className="space-y-4">
            {topProducts.map((tp) => {
              const pct = Math.max(8, Math.round((tp.units_sold / maxUnits) * 100));
              return (
                <div key={tp.sku} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[#111111] truncate">{tp.product_name}</span>
                    <span className="tabular-nums text-[#5A554E] shrink-0">
                      {tp.units_sold} u. · {formatMad(tp.revenue_mad)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#F2ECE3]">
                    <div className="h-full bg-[#B89B5E]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Répartition des commandes */}
      <div className="bg-white border border-[#E6DFD5] p-6">
        <h3 className="text-sm font-semibold text-[#111111]">Répartition des commandes par statut</h3>
        <p className="text-xs text-[#5A554E] mt-0.5 mb-5">Distribution actuelle du carnet de commandes</p>

        {ordersByStatus.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#5A554E]">Aucune commande.</p>
        ) : (
          <div className="space-y-3 tabular-nums">
            {ordersByStatus.map((row) => {
              const pct = Math.round((row.count / totalOrdersStatus) * 100);
              return (
                <div key={row.status} className="flex items-center justify-between gap-4 py-1.5 border-b border-[#F2ECE3] last:border-0 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#111111]">{row.status}</span>
                      <span className="text-[#5A554E]">
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F2ECE3]">
                      <div className="h-full bg-[#111111]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-24 text-right font-medium text-[#111111] shrink-0">
                    {formatMad(row.revenue_mad)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
