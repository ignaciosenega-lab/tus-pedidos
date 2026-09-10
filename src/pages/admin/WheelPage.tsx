import { useState, useEffect, useMemo, useRef } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface CatalogProduct {
  id: number;
  name: string;
  image_url: string;
  base_price: number | null;
  variants?: { price: number }[];
}

interface Prize {
  id: number;
  branch_id: number;
  label: string;
  type: "percentage" | "fixed" | "product";
  product_id: number | null;
  value: number;
  max_discount: number;
  min_order: number;
  weight: number;
  color: string;
  sort_order: number;
  is_active: number;
  probability: number;
}

interface BranchWheelConfig {
  wheel_enabled: number;
  wheel_expires_minutes: number;
  wheel_cooldown_hours: number;
}

interface WheelStats {
  spins: number;
  redeemed: number;
  cost: number;
  uniqueCustomers: number;
  redemptionRate: number;
  byPrize: {
    prize_label: string;
    prize_type: string;
    prize_value: number;
    spins: number;
    redeemed: number;
    cost: number;
  }[];
  withWheel: { orders: number; revenue: number; cost: number; aov: number };
  control: { orders: number; revenue: number; aov: number };
}

type PrizeType = "percentage" | "fixed" | "product";

const EMPTY_FORM = {
  label: "",
  type: "percentage" as PrizeType,
  product_id: null as number | null,
  value: 10,
  max_discount: 0,
  min_order: 0,
  // Arranca en "A veces" para que uno de los botones de frecuencia quede
  // marcado y se entienda que son opciones, no decoración.
  weight: 15,
  // La rueda dibuja todos los gajos en negro; la columna sigue en la base
  // pero ya no se elige desde la UI.
  color: "#0f0f12",
  sort_order: 0,
};


/** Precio de lista de un producto: el base, o el de su primera variante. */
function productPrice(p?: CatalogProduct): number {
  if (!p) return 0;
  return Number(p.base_price) || Number(p.variants?.[0]?.price) || 0;
}

/**
 * Frecuencia como un par "X de cada N". Devuelve el par y NO la frase: la
 * arma el llamador. Cuando devolvía frases enteras, el texto "Va a salir ___
 * veces" terminaba diciendo "Va a salir sale siempre veces".
 *
 * Arriba del 35% un numerador fijo en 1 no tiene resolución —40% y 60% caían
 * los dos en "1 de cada 2"— así que se cambia la base en vez de redondear más.
 */
/**
 * La frecuencia dicha como cociente: "1 de cada 4" se agarra más rápido que
 * "25%". Devuelve el par y NO la frase —la arma el llamador— porque cuando
 * devolvía frases enteras el texto terminaba diciendo "Va a salir sale
 * siempre veces".
 *
 * Arriba del 35% el numerador 1 no tiene resolución (40% y 60% caerían los dos
 * en "1 de cada 2"), así que ahí se cambia la base.
 *
 * Es una APROXIMACIÓN a propósito: dos premios cercanos pueden caer en el
 * mismo cociente, y está bien, porque el porcentaje exacto se muestra al lado.
 * Buscar exactitud llevaba a "23 de cada 100", que no le gana en nada a "23%".
 */
function oneInEvery(probability: number): { x: number; n: number; exact: boolean } | null {
  if (!(probability > 0)) return null;

  const pick = (x: number, n: number) => ({
    x,
    n,
    exact: Math.abs(x / n - probability) < 0.005,
  });

  // Los cocientes redondos (1/2, 1/3, 1/4, 1/5…) se prefieren cuando dan justo.
  const simple = Math.max(2, Math.round(1 / probability));
  if (Math.abs(1 / simple - probability) < 0.005) return pick(1, simple);

  if (probability >= 0.35) {
    return pick(Math.min(9, Math.max(1, Math.round(probability * 10))), 10);
  }
  return pick(1, simple);
}

function frequencyText(probability: number): string {
  const f = oneInEvery(probability);
  if (!f) return "no sale";
  return `${f.exact ? "" : "≈"}${f.x} de cada ${f.n}`;
}

/**
 * Reparte 100 puntos entre los pesos, por restos mayores y con piso 1.
 *
 * La usan TANTO lo que se muestra como lo que se guarda, a propósito: si la
 * barra mostrara w/Σw con decimales y el guardado redondeara aparte, los
 * porcentajes cambiarían solos al apretar Guardar.
 */
function normalize(weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  // Con más de 100 gajos no se puede dar 1 a cada uno: se devuelve crudo.
  if (n > 100) return weights.map((w) => Math.max(0, Math.round(w)));

  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return weights.map(() => Math.floor(100 / n));

  const exact = weights.map((w) => (Math.max(0, w) / total) * 100);
  const floors = exact.map((e) => Math.max(1, Math.floor(e)));
  let left = 100 - floors.reduce((sum, f) => sum + f, 0);

  // Los puntos que sobran van a los que tenían el resto más grande.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floors];
  let k = 0;
  while (left > 0 && order.length > 0) {
    out[order[k % order.length].i] += 1;
    left -= 1;
    k += 1;
  }
  // Si los pisos se pasaron de 100, se recorta de los más gordos.
  while (left < 0) {
    const biggest = out.reduce((best, v, i) => (v > out[best] ? i : best), 0);
    if (out[biggest] <= 1) break;
    out[biggest] -= 1;
    left += 1;
  }
  return out;
}

/**
 * Por qué un gajo no entra en el sorteo, en texto. Antes esto era un booleano
 * mudo y el dueño no tenía forma de saber qué le faltaba al premio.
 */
function notPlayableReason(p: { is_active: number; type: string; product_id: number | null; value: number; weight: number }): string | null {
  if (!p.is_active) return "está apagado";
  if (p.type === "product" && !p.product_id) return "no tiene producto elegido";
  if (p.type !== "product" && p.value <= 0) return "no tiene valor cargado";
  if (p.weight <= 0) return "está en cero";
  return null;
}

/**
 * Colores de la barra de reparto. No salen de la base: los gajos de la ruleta
 * se dibujan todos en negro, así que estos son solo para poder distinguir los
 * tramos acá. Se indexan por posición, sin persistir nada.
 */
const PALETTE = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#a855f7", "#14b8a6", "#ec4899", "#84cc16",
];

const money = (n: number) =>
  "$" + Math.round(n || 0).toLocaleString("es-AR");

export default function WheelPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster } = useBranchId();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [config, setConfig] = useState<BranchWheelConfig>({
    wheel_enabled: 0,
    wheel_expires_minutes: 60,
    wheel_cooldown_hours: 24,
  });
  const [stats, setStats] = useState<WheelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [avgTicket, setAvgTicket] = useState(12000);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // ── Reparto de frecuencias ──
  // `weightDraft` es lo que el usuario está moviendo; `baseRef` guarda lo
  // último que confirmó el server. La diferencia entre los dos es lo que
  // define si hay cambios sin guardar.
  const [weightDraft, setWeightDraft] = useState<Record<number, number>>({});
  const baseRef = useRef<Record<number, number>>({});
  const [savingWeights, setSavingWeights] = useState(false);
  const [creatingQuickStart, setCreatingQuickStart] = useState(false);

  const dirty = Object.keys(weightDraft).some(
    (id) => weightDraft[Number(id)] !== baseRef.current[Number(id)]
  );

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    loadAll();
  }, [branchId]);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [p, b, s, cat] = await Promise.all([
        apiFetch<Prize[]>(`/api/branches/${branchId}/wheel-prizes`),
        apiFetch<BranchWheelConfig>(`/api/branches/${branchId}`),
        apiFetch<WheelStats>(`/api/branches/${branchId}/wheel-stats`).catch(() => null),
        // Para el selector de regalos. Si falla, el resto de la página sigue
        // andando y solo no se pueden cargar premios de tipo producto.
        apiFetch<{ products: CatalogProduct[] }>(`/api/branches/${branchId}/catalog`).catch(() => null),
      ]);
      setPrizes(p);
      if (cat) setProducts(cat.products || []);

      // Merge, no pisada. Toda mutación (prender un gajo, borrarlo, guardar el
      // modal) pasa por acá, y si el borrador se sobreescribiera con lo del
      // server, editarle el nombre a un premio te borraría el reparto a medio
      // armar sin ningún aviso.
      const prevBase = baseRef.current;
      setWeightDraft((prev) => {
        const next: Record<number, number> = {};
        for (const prize of p) {
          const touched = prize.id in prev && prev[prize.id] !== prevBase[prize.id];
          next[prize.id] = touched ? prev[prize.id] : prize.weight;
        }
        return next;
      });
      baseRef.current = Object.fromEntries(p.map((x) => [x.id, x.weight]));
      setConfig({
        wheel_enabled: b.wheel_enabled ?? 0,
        wheel_expires_minutes: b.wheel_expires_minutes ?? 60,
        wheel_cooldown_hours: b.wheel_cooldown_hours ?? 24,
      });
      if (s) setStats(s);
    } catch (err: any) {
      setError(err.message || "Error al cargar la ruleta");
    } finally {
      setLoading(false);
    }
  }

  // Un gajo solo entra en el sorteo si está activo, tiene peso y tiene valor.
  // Ojo: esto usa el peso DEL SERVER, no el del borrador, porque es el que
  // manda mientras el reparto no se guarde.
  const playable = prizes.filter((p) => !notPlayableReason(p));

  // Búsqueda por id en vez de find lineal: sin esto cada movimiento del
  // deslizador dispara N recorridos del catálogo.
  const productPriceById = useMemo(
    () => new Map(products.map((x) => [x.id, productPrice(x)])),
    [products]
  );

  /** Lo que le cuesta a la sucursal que salga este premio. */
  function prizeCost(p: Prize): number {
    if (p.type === "percentage") {
      return Math.min(
        (avgTicket * p.value) / 100,
        p.max_discount > 0 ? p.max_discount : Infinity
      );
    }
    if (p.type === "product") {
      // Un regalo no descuenta, pero sale de la caja igual: cuesta lo que
      // vale el producto.
      return p.value || productPriceById.get(p.product_id ?? -1) || 0;
    }
    return p.value;
  }

  // Los gajos que entran al reparto según el BORRADOR, y su porcentaje.
  // Todo lo que se ve en pantalla (barra, porcentajes, "X de cada N" y costo)
  // sale de acá, para que no haya dos números distintos para lo mismo.
  const { inDraw, sharePct } = useMemo(() => {
    const rows = prizes.filter(
      (p) => !notPlayableReason({ ...p, weight: weightDraft[p.id] ?? p.weight })
    );
    const pts = normalize(rows.map((r) => weightDraft[r.id] ?? r.weight));
    return {
      inDraw: rows,
      sharePct: new Map(rows.map((r, i) => [r.id, pts[i]])),
    };
  }, [prizes, weightDraft]);

  const outOfDraw = prizes.filter((p) => !sharePct.has(p.id));

  // Cuánto cuesta, en promedio, cada giro. Es el número que evita cargar un
  // 50% muy seguido sin darse cuenta de lo que implica. Se recalcula mientras
  // se mueven los deslizadores, antes de guardar.
  const expectedCost = inDraw.reduce(
    (sum, p) => sum + ((sharePct.get(p.id) || 0) / 100) * prizeCost(p),
    0
  );

  // Aviso del navegador al recargar o cerrar con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  /** Guarda todo el reparto de una vez. */
  async function saveWeights() {
    const payload = inDraw.map((p) => ({ id: p.id, weight: sharePct.get(p.id) || 1 }));
    if (payload.length === 0) return;
    try {
      setSavingWeights(true);
      // Se guardan los porcentajes normalizados, los mismos que se están
      // viendo en pantalla. Así lo guardado y lo mostrado no pueden diferir.
      const updated = await apiFetch<Prize[]>(
        `/api/branches/${branchId}/wheel-prizes/weights`,
        { method: "PUT", body: JSON.stringify({ weights: payload }) }
      );
      setPrizes(updated);
      const fresh = Object.fromEntries(updated.map((x) => [x.id, x.weight]));
      baseRef.current = fresh;
      setWeightDraft(fresh);
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el reparto");
    } finally {
      setSavingWeights(false);
    }
  }

  function discardWeights() {
    setWeightDraft({ ...baseRef.current });
  }

  /** Cambiar de sucursal recarga todo y se lleva puesto el borrador. */
  function handleBranchChange(nextId: number) {
    if (
      dirty &&
      !confirm("Tenés cambios sin guardar en el reparto. ¿Los descartás?")
    ) {
      return;
    }
    setBranchId(nextId);
  }

  async function saveConfig(next: Partial<BranchWheelConfig>) {
    const merged = { ...config, ...next };
    setConfig(merged);
    try {
      await apiFetch(`/api/branches/${branchId}`, {
        method: "PUT",
        body: JSON.stringify({
          wheel_enabled: !!merged.wheel_enabled,
          wheel_expires_minutes: merged.wheel_expires_minutes,
          wheel_cooldown_hours: merged.wheel_cooldown_hours,
        }),
      });
    } catch (err: any) {
      alert(err.message || "Error al guardar la configuración");
      loadAll();
    }
  }

  /**
   * Crea N gajos de arranque. Nacen VÁLIDOS, activos y distintos entre sí: el
   * problema de los gajos vacíos se evita creándolos completos, no limpiándolos
   * después. Que nazcan activos es seguro porque la ruleta no se le muestra a
   * nadie hasta que el dueño la prenda.
   */
  async function quickStart(count: number) {
    // Valores distintos entre sí: dos gajos con el mismo texto obligan a
    // editarlos igual, que es justo lo que el arranque rápido viene a evitar.
    const LADDER = [5, 8, 10, 12, 15, 20, 25, 30];
    const share = normalize(new Array(count).fill(1));
    try {
      setCreatingQuickStart(true);
      for (let i = 0; i < count; i++) {
        const pct = LADDER[i] ?? 10;
        await apiFetch(`/api/branches/${branchId}/wheel-prizes`, {
          method: "POST",
          body: JSON.stringify({
            label: `${pct}% OFF`,
            type: "percentage",
            value: pct,
            max_discount: 0,
            min_order: 0,
            weight: share[i],
            color: "#0f0f12",
            sort_order: i + 1,
          }),
        });
      }
    } catch (err: any) {
      // Los que sí se crearon quedan; el dueño sigue con "+ Nuevo gajo".
      alert(err.message || "No se pudieron crear todos los gajos");
    } finally {
      setCreatingQuickStart(false);
      loadAll();
    }
  }

  async function savePrize() {
    if (!form.label.trim()) return alert("Poné el texto del gajo");
    if (form.type === "product" && !form.product_id) {
      return alert("Elegí qué producto se regala");
    }
    if (form.type !== "product" && form.value <= 0) {
      return alert("El valor del premio tiene que ser mayor a 0");
    }
    try {
      setSaving(true);
      const url = editing
        ? `/api/branches/${branchId}/wheel-prizes/${editing.id}`
        : `/api/branches/${branchId}/wheel-prizes`;

      // El peso NO viaja desde el modal: lo maneja el panel de reparto. Al
      // editar ni se manda, así que guardar el modal no puede pisar un reparto
      // a medio armar. Al crear se calcula la parte que le tocaría si el
      // reparto fuera parejo, para no desbalancear lo que ya estaba.
      const { weight: _ignored, ...rest } = form;
      const newWeight = inDraw.length
        ? Math.max(1, Math.round(100 / (inDraw.length + 1)))
        : 20;

      await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(editing ? rest : { ...rest, weight: newWeight }),
      });
      setShowModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al guardar el premio");
    } finally {
      setSaving(false);
    }
  }

  async function togglePrize(p: Prize) {
    try {
      await apiFetch(`/api/branches/${branchId}/wheel-prizes/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al cambiar el estado");
    }
  }

  async function deletePrize(p: Prize) {
    if (!confirm(`¿Eliminar el gajo "${p.label}"?`)) return;
    try {
      const r = await apiFetch<{ softDeleted: boolean }>(
        `/api/branches/${branchId}/wheel-prizes/${p.id}`,
        { method: "DELETE" }
      );
      if (r.softDeleted) {
        alert(
          "El premio ya salió sorteado alguna vez, así que se desactivó en vez de borrarse. " +
            "Así los giros viejos y las estadísticas siguen teniendo sentido."
        );
      }
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: prizes.length + 1 });
    setShowModal(true);
  }

  function openEdit(p: Prize) {
    setEditing(p);
    setForm({
      label: p.label,
      type: p.type,
      product_id: p.product_id,
      value: p.value,
      max_discount: p.max_discount,
      min_order: p.min_order,
      weight: p.weight,
      color: p.color,
      sort_order: p.sort_order,
    });
    setShowModal(true);
  }

  const canEnable = playable.length >= 2;

  if (loading) {
    return <div className="p-6 text-gray-400">Cargando…</div>;
  }

  if (!branchId) {
    return (
      <div className="p-6 text-gray-400">
        No hay ninguna sucursal seleccionada.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Ruleta de premios</h2>
          <p className="text-sm text-gray-400 mt-1">
            El cliente gira una vez, justo antes de mandar el pedido, y gana un descuento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && branches.length > 0 && (
            <select
              value={branchId}
              onChange={(e) => handleBranchChange(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            + Nuevo gajo
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Estado de la ruleta ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-white font-bold">Estado</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-lg">
              Con la ruleta prendida, el botón "Girar y ganar" aparece en el checkout
              solo para los clientes que <strong>no</strong> tienen ya un cupón o una
              promoción aplicada. Nunca se apilan descuentos.
            </p>
          </div>
          <button
            onClick={() => saveConfig({ wheel_enabled: config.wheel_enabled ? 0 : 1 })}
            // Apagar siempre puede: es el freno de mano. Prender no, mientras
            // haya cambios sin guardar, porque pondría en vivo un reparto
            // distinto del que se está mirando en pantalla.
            disabled={!config.wheel_enabled && (!canEnable || dirty)}
            title={
              !config.wheel_enabled && dirty
                ? "Guardá el reparto antes de prender la ruleta"
                : undefined
            }
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              config.wheel_enabled
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {config.wheel_enabled ? "Activada" : "Desactivada"}
          </button>
        </div>

        {!canEnable && (
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 text-amber-300 text-xs">
            Cargá al menos 2 gajos activos con su premio cargado para poder prender la ruleta.
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              El premio vence a los (minutos)
            </label>
            <input
              type="number"
              min={5}
              value={config.wheel_expires_minutes}
              onChange={(e) => setConfig({ ...config, wheel_expires_minutes: Number(e.target.value) })}
              onBlur={() => saveConfig({})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Si el cliente gira y no manda el pedido en ese tiempo, el premio caduca.
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              No vuelve a girar por (horas)
            </label>
            <input
              type="number"
              min={0}
              value={config.wheel_cooldown_hours}
              onChange={(e) => setConfig({ ...config, wheel_cooldown_hours: Number(e.target.value) })}
              onBlur={() => saveConfig({})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Dentro de esta ventana, el mismo celular recibe siempre el premio que ya
              le tocó — aunque refresque, cierre el navegador o borre los datos.
            </p>
          </div>
        </div>
      </div>

      {/* ── Reparto de frecuencias ── */}
      {prizes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-white font-bold">Cómo se reparten los premios</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Moviendo cada barra decidís cada cuánto sale ese premio. Los porcentajes
              son relativos entre sí, así que al mover uno <strong>se reacomodan todos</strong>.
            </p>
          </div>

          {inDraw.length === 0 ? (
            <p className="text-sm text-gray-500">
              Ningún gajo está en condiciones de salir sorteado todavía.
            </p>
          ) : (
            <>
              {/* La torta, estirada. Es lo que hace visible que el reparto es
                  un todo y no cinco decisiones sueltas. */}
              <div className="flex w-full h-8 rounded-lg overflow-hidden border border-gray-800">
                {inDraw.map((p, i) => {
                  const pct = sharePct.get(p.id) || 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-center transition-[width] duration-75"
                      style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                      title={`${p.label} — ${pct}%`}
                    >
                      {pct >= 8 && (
                        <span className="text-[10px] font-bold text-black/70">{pct}%</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                {inDraw.map((p, i) => {
                  const pct = sharePct.get(p.id) || 0;
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-x-4 gap-y-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                        />
                        <span className="text-sm text-white truncate">{p.label}</span>
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={weightDraft[p.id] ?? p.weight}
                        onChange={(e) =>
                          setWeightDraft((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                        }
                        className="w-full accent-emerald-500"
                        aria-label={`Cada cuánto sale ${p.label}`}
                      />

                      <div className="text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-white">{pct}%</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {frequencyText(pct / 100)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Los que quedaron afuera NO se ocultan: si desaparecieran, el dueño
              se quedaría buscando un premio que cargó y no ve en ningún lado. */}
          {outOfDraw.length > 0 && (
            <div className="border-t border-gray-800 pt-3 space-y-1.5">
              <p className="text-xs text-gray-400">
                No entran en el reparto ({outOfDraw.length})
              </p>
              {outOfDraw.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-gray-400">
                    "{p.label}" — {notPlayableReason({ ...p, weight: weightDraft[p.id] ?? p.weight })}
                  </span>
                  {!p.is_active ? (
                    <button
                      onClick={() => togglePrize(p)}
                      className="text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Activar
                    </button>
                  ) : (weightDraft[p.id] ?? p.weight) <= 0 ? (
                    <button
                      onClick={() =>
                        setWeightDraft((prev) => ({
                          ...prev,
                          [p.id]: Math.max(1, Math.round(100 / (inDraw.length + 1))),
                        }))
                      }
                      className="text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Sumar al reparto
                    </button>
                  ) : (
                    <button
                      onClick={() => openEdit(p)}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {dirty && (
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 text-amber-300 text-xs">
              Estos porcentajes todavía no están guardados. La ruleta sigue repartiendo
              como antes.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-800 pt-4">
            <div className="text-xs text-gray-400">
              Costo por giro:{" "}
              <span className={expectedCost / avgTicket > 0.15 ? "text-red-400 font-bold" : "text-white font-bold"}>
                {money(expectedCost)}
              </span>
              {avgTicket > 0 && (
                <span className="ml-1">({((expectedCost / avgTicket) * 100).toFixed(1)}%)</span>
              )}
            </div>
            <div className="flex gap-2">
              {dirty && (
                <button
                  onClick={discardWeights}
                  className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-800"
                >
                  Deshacer
                </button>
              )}
              <button
                onClick={saveWeights}
                disabled={!dirty || savingWeights}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
              >
                {savingWeights ? "Guardando…" : "Guardar reparto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Costo esperado ── */}
      {inDraw.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-bold mb-1">Cuánto te va a costar</h3>
          <p className="text-xs text-gray-400 mb-4">
            Cuánto te sale, en promedio, cada giro — según el reparto que armaste arriba.
            Se actualiza mientras movés las barras, antes de guardar.
          </p>
          <div className="flex items-end gap-6 flex-wrap">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ticket promedio</label>
              <input
                type="number"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-gray-400">Costo promedio por giro</div>
              <div className="text-2xl font-bold text-white">{money(expectedCost)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Sobre el ticket</div>
              <div
                className={`text-2xl font-bold ${
                  expectedCost / avgTicket > 0.15 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {avgTicket > 0 ? ((expectedCost / avgTicket) * 100).toFixed(1) : "0"}%
              </div>
            </div>
          </div>
          {expectedCost / avgTicket > 0.15 && (
            <div className="mt-4 bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-red-300 text-xs">
              Estás regalando más del 15% del ticket en promedio. Bajales la barra a los
              premios más caros, o ponéles un tope en pesos.
            </div>
          )}
        </div>
      )}

      {/* ── Gajos ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-bold">Gajos ({prizes.length})</h3>
        </div>
        {prizes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white font-semibold mb-1">Todavía no cargaste ningún premio</p>
            <p className="text-sm text-gray-400 mb-5">
              ¿Cuántos querés en la ruleta? Los creamos con descuentos de ejemplo y el
              reparto parejo, y después los editás.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[3, 4, 5, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => quickStart(n)}
                  disabled={creatingQuickStart}
                  className="w-12 h-12 rounded-lg bg-gray-800 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
            {creatingQuickStart && (
              <p className="text-xs text-gray-500 mt-4">Creando los gajos…</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {["Gajo", "Premio", "Tope", "Mínimo", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {prizes.map((p) => (
                  <tr key={p.id} className={p.is_active ? "" : "opacity-40"}>
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">{p.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {p.type === "percentage"
                        ? `${p.value}%`
                        : p.type === "product"
                          ? "🎁 regalo"
                          : money(p.value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {p.max_discount > 0 ? money(p.max_discount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {p.min_order > 0 ? money(p.min_order) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePrize(p)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          p.is_active
                            ? "bg-emerald-900/50 text-emerald-300"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {p.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="text-blue-400 hover:text-blue-300 text-sm mr-3">
                        Editar
                      </button>
                      <button onClick={() => deletePrize(p)} className="text-red-400 hover:text-red-300 text-sm">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Resultados ── */}
      {stats && stats.spins > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-5">
          <h3 className="text-white font-bold">Resultados</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Giros", value: stats.spins.toLocaleString("es-AR") },
              { label: "Premios usados", value: stats.redeemed.toLocaleString("es-AR") },
              { label: "Tasa de canje", value: `${(stats.redemptionRate * 100).toFixed(0)}%` },
              { label: "Costo real", value: money(stats.cost) },
            ].map((k) => (
              <div key={k.label}>
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className="text-xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          {stats.withWheel.orders > 0 && stats.control.orders > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-2">
                Ticket promedio: pedidos con ruleta vs pedidos sin ningún descuento
              </div>
              <div className="flex gap-8">
                <div>
                  <div className="text-xs text-gray-500">Con ruleta ({stats.withWheel.orders})</div>
                  <div className="text-lg font-bold text-emerald-400">{money(stats.withWheel.aov)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Sin descuento ({stats.control.orders})</div>
                  <div className="text-lg font-bold text-gray-300">{money(stats.control.aov)}</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                La comparación es contra pedidos sin ningún descuento a propósito: como la
                ruleta solo se ofrece a esos clientes, compararla contra el total de pedidos
                daría un número engañoso.
              </p>
            </div>
          )}

          {stats.byPrize.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase">
                    <th className="text-left py-2">Premio</th>
                    <th className="text-left py-2">Salió</th>
                    <th className="text-left py-2">Usado</th>
                    <th className="text-left py-2">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stats.byPrize.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-white">{r.prize_label}</td>
                      <td className="py-2 text-gray-300">{r.spins}</td>
                      <td className="py-2 text-gray-300">{r.redeemed}</td>
                      <td className="py-2 text-gray-300">{money(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de alta/edición ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">{editing ? "Editar gajo" : "Nuevo gajo"}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Texto del gajo</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="10% OFF"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">Es lo que el cliente lee en la ruleta.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value as PrizeType;
                      setForm({ ...form, type, value: type === "product" ? 0 : form.value || 10 });
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Monto fijo</option>
                    <option value="product">Producto de regalo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {form.type === "percentage"
                      ? "Porcentaje"
                      : form.type === "product"
                        ? "Costo estimado en $"
                        : "Monto en $"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                    placeholder={form.type === "product" ? "0 = usar precio de lista" : ""}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              {form.type === "product" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Qué se regala</label>
                  {products.length === 0 ? (
                    <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 text-amber-300 text-xs">
                      No se pudo cargar el catálogo, así que no hay productos para elegir.
                      Recargá la página e intentá de nuevo.
                    </div>
                  ) : (
                    <>
                      <input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar producto…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-2"
                      />
                      <div className="max-h-44 overflow-y-auto border border-gray-800 rounded-lg divide-y divide-gray-800">
                        {products
                          .filter((pr) =>
                            pr.name.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .slice(0, 40)
                          .map((pr) => {
                            const selected = form.product_id === pr.id;
                            return (
                              <button
                                key={pr.id}
                                type="button"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    product_id: pr.id,
                                    // El texto del gajo arranca con el nombre del
                                    // producto, pero se puede editar arriba.
                                    label: form.label.trim() ? form.label : pr.name,
                                  })
                                }
                                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                                  selected ? "bg-emerald-600/20" : "hover:bg-gray-800"
                                }`}
                              >
                                {pr.image_url ? (
                                  <img src={pr.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                ) : (
                                  <span className="w-8 h-8 rounded bg-gray-800 shrink-0" />
                                )}
                                <span className="text-sm text-white flex-1 truncate">{pr.name}</span>
                                <span className="text-xs text-gray-500">{money(productPrice(pr))}</span>
                                {selected && <span className="text-emerald-400 text-xs">✓</span>}
                              </button>
                            );
                          })}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        El regalo <strong>no baja el total</strong>: se suma a la bolsa y le llega
                        a la sucursal en el mensaje de WhatsApp. El costo estimado es solo para
                        que las métricas te digan cuánto te salió la ruleta.
                      </p>
                    </>
                  )}
                </div>
              )}

              {form.type === "percentage" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tope en $ (0 = sin tope)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.max_discount}
                    onChange={(e) => setForm({ ...form, max_discount: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Sin tope, un 20% sobre un pedido grande puede costarte mucho más de lo que esperabas.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pedido mínimo en $</label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_order}
                    onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-500 bg-gray-800/40 rounded-lg px-3 py-2.5">
                Cada cuánto sale este premio no se define acá: se ajusta abajo, en
                <strong> "Cómo se reparten los premios"</strong>, junto con todos los demás.
              </p>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Orden en la ruleta</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  En qué posición aparece el gajo. Todos los gajos se dibujan en negro,
                  separados por una línea roja.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-700 py-2 rounded-lg text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={savePrize}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2 rounded-lg text-white text-sm font-medium"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
