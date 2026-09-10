import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../store/authContext";

interface HelpSection {
  id: string;
  title: string;
  summary: string;
  category: "intro" | "branch" | "master" | "campaigns" | "glossary";
  masterOnly?: boolean;
  /**
   * Términos que el buscador indexa además del título y el resumen. Hace
   * falta porque `body` es JSX y no se puede leer como texto: sin esto,
   * buscar una palabra que solo aparece dentro de una sección no encuentra
   * nada. Poné acá los sinónimos y las palabras que alguien tipearía.
   */
  keywords?: string;
  body: ReactNode;
}

const CATEGORY_LABEL: Record<HelpSection["category"], string> = {
  intro: "Bienvenida",
  branch: "Tu sucursal",
  master: "Master Admin",
  campaigns: "Campañas WhatsApp",
  glossary: "Glosario",
};

const CATEGORY_ORDER: HelpSection["category"][] = [
  "intro",
  "branch",
  "master",
  "campaigns",
  "glossary",
];

/* ──────────────────────────────────────────────────
   Componentes auxiliares para el cuerpo
   ────────────────────────────────────────────────── */

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-amber-500/10 border-l-2 border-amber-500 p-3 rounded text-sm text-amber-200 my-3">
      <span className="font-semibold mr-1">💡 Tip:</span> {children}
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="bg-red-500/10 border-l-2 border-red-500 p-3 rounded text-sm text-red-200 my-3">
      <span className="font-semibold mr-1">⚠ Atención:</span> {children}
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-300">{children}</ol>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">{children}</ul>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-300 leading-relaxed">{children}</p>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-white font-semibold text-sm mt-5 mb-2">{children}</h3>;
}

function K({ children }: { children: ReactNode }) {
  return (
    <code className="bg-gray-800 text-emerald-300 px-1.5 py-0.5 rounded text-[12px] font-mono">
      {children}
    </code>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

/* ──────────────────────────────────────────────────
   CONTENIDO DEL MANUAL
   ────────────────────────────────────────────────── */

const SECTIONS: HelpSection[] = [
  /* ────── INTRO ────── */
  {
    id: "que-es",
    title: "¿Qué es este sistema?",
    summary: "Vista general de qué hace y para qué sirve.",
    category: "intro",
    body: (
      <Section>
        <P>
          Es la plataforma de pedidos online de Jiro Sushi. Cada sucursal tiene su propio
          storefront (sitio público) donde los clientes arman el pedido y lo envían por
          WhatsApp. Desde el admin gestionás el catálogo, los precios, las promos, los
          cupones, los horarios y los pedidos.
        </P>
        <H3>Qué incluye</H3>
        <UL>
          <li>Catálogo de productos con variantes, toppings, fotos y descripción.</li>
          <li>Multi-sucursal con subdominios (<K>mendoza.pedidos.jirosushi.com.ar</K>, etc.).</li>
          <li>Pedidos del cliente → mensaje a WhatsApp del local + registro en la DB.</li>
          <li>Promociones (% off clásicas y 2x1) y cupones con código.</li>
          <li>Mapa interactivo de sucursales con búsqueda por dirección.</li>
          <li>Horarios multi-turno (almuerzo y cena en el mismo día).</li>
          <li>Snapshots / puntos de restauración para volver atrás si algo se rompe.</li>
        </UL>
      </Section>
    ),
  },
  {
    id: "roles",
    title: "Roles y permisos",
    summary: "Master, admin de sucursal y staff: qué puede hacer cada uno.",
    category: "intro",
    body: (
      <Section>
        <P>El sistema tiene tres niveles de acceso. Cada login te lleva a las pantallas que correspondan a tu rol.</P>
        <H3>Master</H3>
        <P>
          Acceso total. Maneja el catálogo global (productos, categorías, variantes),
          crea menús y sucursales, asigna usuarios admin, ve métricas y pedidos
          cross-branch, restaura snapshots.
        </P>
        <H3>Admin de sucursal (<K>branch_admin</K>)</H3>
        <P>
          Gestiona SU sucursal: catálogo (activar/desactivar productos), productos
          propios exclusivos, promociones, cupones, configuración (horarios, dirección,
          medios de pago), zonas de envío, pedidos y métricas. No ve el catálogo global
          ni crea menús ni puede tocar otras sucursales.
        </P>
        <H3>Staff</H3>
        <P>
          Acceso operativo (pedidos, KDS). No edita catálogo, ni promos, ni cupones.
          Pensado para personal de salón / cocina.
        </P>
        <Tip>
          Como master podés impersonar la vista de una sucursal específica usando el
          selector que aparece arriba en las páginas que aplican (catálogo, promociones,
          configuración, etc.).
        </Tip>
      </Section>
    ),
  },
  {
    id: "storefront",
    title: "Qué ve el cliente",
    summary: "El recorrido del cliente desde elegir sucursal hasta WhatsApp.",
    category: "intro",
    body: (
      <Section>
        <P>El flujo del cliente es:</P>
        <Steps>
          <li>
            Entra al sitio (dominio master o subdominio de sucursal). Si llega al master
            (<K>www</K>), ve la pantalla <strong>Seleccioná tu sucursal</strong> con
            tarjetas + tab <strong>Mapa</strong> con pines de todas las sucursales.
          </li>
          <li>
            Puede tipear su dirección en el buscador (autocompletado de Google Places)
            o apretar <strong>Usar mi ubicación</strong>. Las sucursales se reordenan
            por cercanía y se muestra un círculo de 3 km.
          </li>
          <li>Elige la sucursal → entra al catálogo de esa sucursal.</li>
          <li>
            Arma el pedido: agrega productos (con variantes/toppings si aplica), ve el
            carrito con descuentos aplicados (auto-promos 2x1, cupones manuales).
          </li>
          <li>
            En el checkout completa nombre, teléfono y dirección (Google Places
            autocompleta y detecta si está fuera de la zona de envío).
          </li>
          <li>
            Al apretar <strong>Enviar por WhatsApp</strong>, se abre WhatsApp con el
            mensaje del pedido prearmado al número del local. El order también queda
            registrado en la DB para que vos lo veas en Pedidos.
          </li>
        </Steps>
        <Tip>
          Las categorías que NO tienen productos visibles para esa sucursal se ocultan
          automáticamente en el navegador del cliente. Si Palermo no tiene productos en
          "Bebidas", la categoría no aparece en el storefront de Palermo.
        </Tip>
      </Section>
    ),
  },

  /* ────── BRANCH ────── */
  {
    id: "catalogo-sucursal",
    title: "Catálogo de tu sucursal",
    summary: "Activar/desactivar productos y cargar 'Productos propios'.",
    category: "branch",
    body: (
      <Section>
        <P>
          El catálogo viene del master (productos globales). Vos podés decidir qué
          productos están disponibles en tu sucursal, y también cargar productos
          PROPIOS que solo se ven en la tuya.
        </P>
        <H3>Activar / desactivar productos del catálogo global</H3>
        <Steps>
          <li>Andá a <strong>Catálogo</strong>.</li>
          <li>En la tabla, hacé click en el botón verde <strong>DISPONIBLE</strong> / rojo <strong>NO DISPONIBLE</strong> de cada producto.</li>
          <li>El cambio se aplica al instante en tu storefront.</li>
        </Steps>
        <H3>Productos propios (exclusivos)</H3>
        <P>
          Arriba del catálogo hay una sección <strong>🔒 Productos propios</strong>.
          Estos son items que cargás vos y NO los ven otras sucursales.
        </P>
        <Steps>
          <li>Apretá <strong>+ Nuevo</strong>.</li>
          <li>Completá nombre, descripción, categoría, foto y precio.</li>
          <li>Guardar. El producto queda exclusivo del menú asignado a tu sucursal.</li>
        </Steps>
        <Tip>
          Para que esto funcione, el master tiene que haberle asignado un menú dedicado
          a tu sucursal (no el menú genérico compartido). Si no podés ver la sección,
          pedí que te asignen un menú propio.
        </Tip>
        <Warn>
          Si el master agrega ese producto a otro menú también, ya no podés editarlo
          desde tu panel (porque deja de ser "solo tuyo"). En ese caso se vuelve un
          producto compartido y solo el master lo toca.
        </Warn>
      </Section>
    ),
  },
  {
    id: "promociones",
    title: "Promociones",
    summary: "% off clásico y promo '2x1 al mismo producto'.",
    category: "branch",
    body: (
      <Section>
        <P>Hay dos tipos de promoción:</P>
        <H3>Porcentaje de descuento (clásico)</H3>
        <P>
          Aplica un % off al precio del catálogo. Podés alcanzar a TODOS los productos,
          a UNA categoría o a PRODUCTOS específicos. El precio sale tachado en el
          storefront con la nueva tarifa abajo.
        </P>
        <H3>Descuento por unidades del mismo producto (estilo 2x1)</H3>
        <P>
          Por cada N unidades del MISMO producto en el carrito, se aplica el % off a
          esas N unidades. Las sobrantes pagan precio lleno. Es un "2x1" clásico cuando
          ponés N=2 y 50% off.
        </P>
        <UL>
          <li>qty=1 → paga 1 entero.</li>
          <li>qty=2 → 50% off en las dos = paga 1 entero (2x1).</li>
          <li>qty=3 → 2 con 50% + 1 lleno = paga 2 enteros.</li>
          <li>qty=4 → 2 pares de 50% = paga 2 enteros (4x2).</li>
        </UL>
        <H3>Configuración común a las dos</H3>
        <UL>
          <li><strong>Aplica a</strong>: Todos / Categorías / Productos específicos.</li>
          <li><strong>Fechas</strong>: rango único o <strong>Repetir semanalmente</strong> en el día elegido.</li>
          <li><strong>Horario</strong>: todo el día o entre HH:MM y HH:MM.</li>
          <li><strong>Sucursales</strong> (si sos master o branch con permiso multi): solo esta / todas / seleccionadas.</li>
        </UL>
        <Tip>
          El badge <strong>Activa / Inactiva</strong> en el listado prende o apaga la
          promo al instante sin tener que editarla.
        </Tip>
        <Warn>
          Cuando armás una promo "Solo los miércoles", elegí bien el <strong>Día</strong>
          y tildá <strong>Repetir semanalmente</strong>. Si la dejás como rango con
          fecha de inicio en un jueves, se va a disparar los jueves.
        </Warn>
      </Section>
    ),
  },
  {
    id: "ruleta",
    title: "Ruleta de premios",
    summary: "El cliente gira antes de mandar el pedido y gana un descuento.",
    category: "branch",
    keywords: "ruleta premio giro sorteo descuento juego gamificacion girar gajo regalo producto gratis obsequio",
    body: (
      <Section>
        <P>
          Justo antes de mandar el pedido, al cliente le aparece un botón
          <strong> "Girar y ganar"</strong>. Gira una ruleta, le sale un descuento y
          se le aplica a ese mismo pedido.
        </P>

        <H3>Cargar los premios</H3>
        <Steps>
          <li>
            Entrá a <strong>Ruleta</strong> y tocá <strong>+ Nuevo gajo</strong>.
          </li>
          <li>
            <strong>Texto del gajo</strong>: lo que el cliente lee en la rueda ("10% OFF").
          </li>
          <li>
            <strong>Tipo y valor</strong>: porcentaje sobre el pedido, un monto fijo en pesos,
            o un <strong>producto de regalo</strong>.
          </li>
          <li>
            <strong>Tope</strong>: el máximo en pesos que ese premio puede descontar.
          </li>
          <li>
            <strong>Pedido mínimo</strong>: si el pedido no llega a ese monto, el premio no aplica.
          </li>
          <li>
            <strong>Peso</strong>: cuántas chances tiene ese gajo frente a los demás.
          </li>
        </Steps>

        <H3>El producto de regalo</H3>
        <P>
          Elegís un producto de tu catálogo con el buscador y ese es el premio.
          A diferencia de los otros dos, <strong>el regalo no baja el total del pedido</strong>:
          el cliente paga lo mismo y vos le sumás el producto a la bolsa.
        </P>
        <P>
          A la sucursal le llega en el mensaje de WhatsApp, debajo del total, con una
          línea que dice <K>🎡 Ruleta — REGALO: (el producto)</K>.
        </P>
        <Tip>
          El <strong>costo estimado</strong> es opcional y no lo ve el cliente: si lo dejás
          en 0, se usa el precio de lista del producto. Sirve para que el panel de
          "Cuánto te va a costar" y las estadísticas cuenten el regalo como lo que
          realmente te sale, aunque no haya sido un descuento.
        </Tip>
        <Tip>
          Combinalo con <strong>pedido mínimo</strong>: "postre de regalo en pedidos de más
          de $20.000" sube el ticket en vez de solo regalar.
        </Tip>

        <H3>Cómo funciona el peso</H3>
        <P>
          El peso <strong>no es un porcentaje</strong>: es cuántas "chances" tiene cada
          gajo. Si cargás tres premios con peso 50, 30 y 20, salen 50%, 30% y 20% de las
          veces. Si cargás 5, 3 y 2, sale exactamente lo mismo. La columna
          <strong> Probabilidad</strong> te muestra la cuenta ya hecha, y se actualiza sola
          cuando agregás, sacás o desactivás un gajo.
        </P>

        <Warn>
          Ponéle <strong>tope en pesos</strong> a los premios porcentuales. Un 20% sin tope
          sobre un pedido grande puede costarte mucho más de lo que tenías pensado.
        </Warn>

        <H3>Cuánto te va a costar</H3>
        <P>
          El panel <strong>"Cuánto te va a costar"</strong> calcula el descuento promedio
          por giro según los pesos que cargaste. Cambiá el ticket promedio por el tuyo
          real y mirá el porcentaje: si pasa el 15% te lo marca en rojo. Ese es el número
          para decidir, no el premio más grande de la lista.
        </P>

        <H3>Nunca se apilan descuentos</H3>
        <P>
          La ruleta <strong>solo se le ofrece a los clientes que no tienen ya un descuento</strong>:
          si aplicaron un cupón o si en el carrito hay una promoción activa, el botón de
          girar no aparece. Es a propósito, para que un pedido no acumule dos rebajas.
        </P>

        <H3>No se puede volver a girar</H3>
        <P>
          El resultado se decide en el servidor y queda guardado contra el celular del
          cliente. Si refresca la página, cierra el navegador, borra los datos o entra en
          modo incógnito, <strong>le vuelve a salir el mismo premio</strong>. No hay forma de
          tirar de nuevo hasta que salga el bueno.
        </P>
        <P>
          Los dos tiempos que configurás arriba controlan esto:
        </P>
        <UL>
          <li>
            <strong>El premio vence a los (minutos)</strong>: si gira y no manda el pedido en
            ese tiempo, el premio caduca.
          </li>
          <li>
            <strong>No vuelve a girar por (horas)</strong>: dentro de esa ventana el mismo
            celular siempre recibe el premio que ya le tocó, aunque el anterior haya
            vencido.
          </li>
        </UL>

        <H3>Prender la ruleta</H3>
        <P>
          Necesitás al menos <strong>dos gajos activos</strong> para poder activarla. El
          botón de arriba a la derecha la prende y la apaga al instante, sin tocar nada más.
        </P>

        <Tip>
          El descuento le llega a la sucursal en el mensaje de WhatsApp, con una línea que
          dice <K>🎡 Ruleta — 10% OFF</K>. En <strong>Resultados</strong> ves cuántos giros
          hubo, cuántos terminaron en pedido y cuánto te costó de verdad.
        </Tip>
      </Section>
    ),
  },
  {
    id: "cupones",
    title: "Cupones",
    summary: "Códigos con descuento que el cliente tipea en el carrito.",
    category: "branch",
    body: (
      <Section>
        <P>
          Los cupones tienen un <strong>código</strong> (ej. <K>BIENVENIDA10</K>) que
          el cliente ingresa en el carrito. A diferencia de las promos, NO se aplican
          solos.
        </P>
        <H3>Campos del cupón</H3>
        <UL>
          <li><strong>Código</strong>: en mayúsculas.</li>
          <li><strong>Tipo</strong>: porcentaje (10%) o monto fijo ($1.000).</li>
          <li><strong>Pedido mínimo</strong>: monto a partir del cual aplica.</li>
          <li><strong>Máximo de usos</strong>: 0 = ilimitado.</li>
          <li><strong>Solo primera compra</strong>: se valida contra el teléfono del cliente.</li>
          <li><strong>Días activos</strong>: lunes a domingo, los que tildes.</li>
          <li><strong>Horario</strong>: rango opcional HH:MM a HH:MM.</li>
          <li><strong>Fechas</strong>: desde / hasta.</li>
          <li><strong>Aplica a</strong>: todos / categorías / productos.</li>
          <li><strong>Sucursales</strong>: solo esta / todas / seleccionadas (igual que promos).</li>
        </UL>
        <Tip>
          El cupón nunca se suma a una promo: si una promo ya descuenta más, el cupón
          no agrega nada extra. Esto evita doble dipping y siempre el cliente paga el
          monto más conveniente para él.
        </Tip>
      </Section>
    ),
  },
  {
    id: "configuracion-sucursal",
    title: "Configuración de tu sucursal",
    summary: "Datos, horarios multi-turno, feriados, pagos, dirección.",
    category: "branch",
    body: (
      <Section>
        <P>
          La página <strong>Configuración</strong> concentra los datos de la sucursal.
          Lo más usado al día a día son los <strong>horarios</strong>.
        </P>
        <H3>Horarios multi-turno (estilo Google)</H3>
        <P>
          Cada día puede tener varios turnos. Apretá el checkbox del día para activarlo
          y agregá un turno (ej. 12:00 a 15:00). Después <strong>+ Agregar horario</strong>
          para sumar otro (ej. 19:00 a 23:00). Si querés cerrar ese día, destildá el
          checkbox.
        </P>
        <H3>Fechas especiales de cierre</H3>
        <P>Agregá feriados o vacaciones con su motivo. El storefront muestra "Cerrado por {`<motivo>`}".</P>
        <H3>Pausar manualmente</H3>
        <P>
          Si necesitás cerrar al toque (te quedaste sin stock, problema de cocina, etc.),
          usá el botón <strong>Sucursal abierta / cerrada</strong>. Sobreescribe los
          horarios hasta que vuelvas a tildar.
        </P>
        <H3>Métodos de pago y delivery</H3>
        <P>
          Marcá los medios de pago que aceptás. <strong>Modo delivery</strong>: envío,
          retiro o las dos. <strong>Costo de envío base</strong>: el default si el
          cliente queda fuera de cualquier zona definida (sino gana la zona).
        </P>
        <H3>Dirección / link Google Maps</H3>
        <P>
          La dirección es lo que se muestra en el selector de sucursal y al cliente al
          retirar. El link de Google Maps es opcional pero útil para que el cliente
          arme la navegación.
        </P>
      </Section>
    ),
  },
  {
    id: "zonas-envio",
    title: "Zonas de envío",
    summary: "Polígonos con costo + import de KML.",
    category: "branch",
    body: (
      <Section>
        <P>
          Cada sucursal puede tener zonas de envío con costos distintos. Cuando el
          cliente elige su dirección en el checkout, el sistema mira en qué polígono
          cae y le aplica el costo correspondiente.
        </P>
        <H3>Crear una zona</H3>
        <Steps>
          <li>Andá a <strong>Zonas de envío</strong>.</li>
          <li>Apretá <strong>+ Nueva zona</strong>, ponele nombre, color y costo.</li>
          <li>Dibujá el polígono en el mapa (haces click en los vértices).</li>
          <li>Guardar.</li>
        </Steps>
        <H3>Importar desde Google MyMaps (KML)</H3>
        <P>
          Si ya tenés zonas dibujadas en MyMaps, exportalas a KML y subilas desde el
          botón <strong>Importar KML</strong>. Cada polígono del archivo se convierte
          en una zona.
        </P>
        <Tip>
          Si el cliente queda fuera de TODAS las zonas, le aparece un aviso "Fuera de
          zona" en el checkout. Configurá un costo base en Configuración si querés
          aceptar igual.
        </Tip>
      </Section>
    ),
  },
  {
    id: "pedidos-operacion",
    title: "Pedidos y Operación",
    summary: "Cómo gestionar los pedidos que entran.",
    category: "branch",
    body: (
      <Section>
        <P>
          Cada vez que un cliente confirma, el pedido entra en la página{" "}
          <strong>Operación</strong>. Mostramos los últimos pedidos con cliente,
          horario, total y estado.
        </P>
        <H3>Estados</H3>
        <P>
          Pendiente → Confirmado → Preparando → Listo → Entregando → Entregado / Cancelado.
          Avanzá manualmente con los botones del pedido.
        </P>
        <H3>Pausar / reabrir la sucursal en caliente</H3>
        <P>
          Desde Operación podés cerrar al toque o agregar un retraso (delay) si la
          cocina está saturada. El storefront refleja el cambio enseguida.
        </P>
      </Section>
    ),
  },
  {
    id: "clientes-mapa",
    title: "Clientes y mapa",
    summary: "Ver dónde están tus clientes geográficamente.",
    category: "branch",
    body: (
      <Section>
        <P>
          La página <strong>Clientes</strong> lista a tus clientes con teléfono,
          cantidad de pedidos y total gastado. Apretá <strong>Mapa</strong> para ver
          un mapa con un punto amarillo por cliente (las coordenadas vienen del
          checkout con Google Places).
        </P>
        <Tip>
          Si un cliente nunca usó el selector de Google al checkout, no aparece en el
          mapa (porque no quedó guardada su coordenada). El mapa solo muestra los que
          tienen lat/lng válidos.
        </Tip>
      </Section>
    ),
  },
  {
    id: "diseno",
    title: "Diseño (estilos)",
    summary: "Colores, fuentes, logo, banners.",
    category: "master",
    masterOnly: true,
    keywords: "colores fuente tipografia logo favicon banner slider marca estilo aspecto",
    body: (
      <Section>
        <P>
          En <strong>Diseño</strong> podés personalizar el look del storefront de tu
          sucursal: colores del header, body, paneles, botones, texto principal y
          títulos.
        </P>
        <UL>
          <li><strong>Logo</strong> y <strong>favicon</strong> (sube desde Recursos o pegá URL).</li>
          <li><strong>Banners</strong> y <strong>slider</strong> de imágenes.</li>
          <li><strong>Tipografía</strong>: elegí entre la lista o pegá una URL de Google Fonts.</li>
          <li><strong>Footer</strong>: activar/desactivar y sus colores.</li>
        </UL>
      </Section>
    ),
  },
  {
    id: "metricas",
    title: "Métricas",
    summary: "Embudo de conversión, ranking de productos y patrones por día y hora.",
    category: "branch",
    keywords: "estadisticas kpi embudo funnel conversion productos vendidos horarios ventas datos analitica",
    body: (
      <Section>
        <P>La página tiene tres pestañas y un filtro por rango de fechas.</P>

        <H3>Embudo</H3>
        <P>
          Sesiones → vistas de producto → checkouts iniciados → pedidos. Sirve para ver
          <strong> dónde se te cae la gente</strong>. Si entran muchos y ven pocos productos,
          el problema son las fotos o los precios; si abren el checkout y no terminan,
          el problema está en el checkout (zona de envío, horarios, formas de pago).
        </P>

        <H3>Productos</H3>
        <P>
          Vistas, unidades vendidas, compras y facturación por producto. Se puede ordenar
          por cualquier columna. Un producto muy visto y poco comprado suele ser un
          problema de precio o de foto.
        </P>

        <H3>Patrones</H3>
        <P>
          Cómo se reparten los pedidos por día de la semana y por hora. Es el dato para
          decidir turnos de cocina y a qué hora conviene mandar una campaña.
        </P>

        <Tip>
          Los números vienen del tráfico real de tu tienda, no de Google Analytics. Un
          pedido cuenta cuando el cliente toca Enviar, aunque después no confirme por
          WhatsApp.
        </Tip>
      </Section>
    ),
  },

  /* ────── MASTER ────── */
  {
    id: "catalogo-global",
    title: "Catálogo global",
    summary: "Productos, variantes, toppings y exclusividad por menú.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          El catálogo global vive en <K>/admin/catalogo</K>. Acá creás los productos
          que después las sucursales muestran/ocultan.
        </P>
        <H3>Crear un producto</H3>
        <Steps>
          <li>Apretá <strong>+ Nuevo producto</strong>.</li>
          <li>Completá nombre, descripción, categoría, foto.</li>
          <li>
            Tipo <strong>Simple</strong> (un precio) o <strong>Con opciones</strong>
            (variantes con su propio precio: chico/mediano/grande, por ejemplo).
          </li>
          <li>Badges opcionales: <K>sin_tacc</K>, <K>nuevo</K>.</li>
          <li>
            <strong>Disponibilidad por menú</strong>: elegí "Visible en todos" (default,
            global) o "Solo en menús específicos" y tildá los menús. Esto define en qué
            sucursales aparece (las que tienen asignados esos menús).
          </li>
          <li>Guardar.</li>
        </Steps>
        <H3>Crear categoría inline</H3>
        <P>
          En el form del producto, al lado del selector de Categoría hay un botón
          <strong> + Nueva</strong>. Tipeás el nombre, Enter, y la categoría se crea y
          queda autoseleccionada.
        </P>
        <H3>Variantes y toppings</H3>
        <UL>
          <li><strong>Variantes</strong>: cada una tiene label + precio (ej. "1/4 lb" $4.500).</li>
          <li><strong>Toppings</strong>: extras opcionales que el cliente puede sumar.</li>
        </UL>
        <Tip>
          En el listado, un badge violeta <strong>🔒 {`<menú>`}</strong> indica que el
          producto es exclusivo de ese menú. Si no tiene badge, lo ven todas las
          sucursales.
        </Tip>
      </Section>
    ),
  },
  {
    id: "menus-y-precios",
    title: "Menús y reglas de precio",
    summary: "Crear menús, asignarlos a sucursales, aplicar % off o sobreprecio.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Un <strong>menú</strong> es una plantilla de precios y un identificador para
          decidir qué productos exclusivos ve cada sucursal. La sucursal con menú "X"
          ve los productos globales + los exclusivos del menú X.
        </P>
        <H3>Crear o duplicar</H3>
        <Steps>
          <li>Andá a <strong>Menús</strong> y apretá <strong>+ Nuevo</strong>.</li>
          <li>
            Si querés partir de uno existente, apretá <strong>Duplicar</strong> en su
            fila.
          </li>
          <li>Definí el nombre y la regla de precio.</li>
        </Steps>
        <H3>Regla de precio</H3>
        <UL>
          <li><strong>none</strong>: el precio del catálogo se usa tal cual.</li>
          <li><strong>percentage</strong>: aplica + o - X% al precio base.</li>
        </UL>
        <H3>Redondeo</H3>
        <UL>
          <li><strong>none</strong> / <strong>round_10</strong> / <strong>round_50</strong> / <strong>round_100</strong>.</li>
        </UL>
        <H3>Asignar a una sucursal</H3>
        <P>
          Andá a <strong>Sucursales</strong>, editá la sucursal y elegí el menú. Desde
          ese momento sus precios se calculan con la regla de ese menú y ve los
          productos exclusivos asignados.
        </P>
        <Tip>
          Si una sucursal está en una plaza con costos más altos, usá una regla de +25%.
          Si querés correr una promo permanente para una franquicia testigo, usá -10%.
        </Tip>
      </Section>
    ),
  },
  {
    id: "sucursales",
    title: "Sucursales",
    summary: "Alta/baja, subdominios, asignación de menú.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Cada sucursal tiene un <K>slug</K> (parte del subdominio,{" "}
          <K>mendoza.pedidos.jirosushi.com.ar</K>) y un nombre. Desde acá la das de alta
          y le asignás un menú.
        </P>
        <Steps>
          <li>+ Nueva sucursal: slug y nombre obligatorios.</li>
          <li>Elegí el menú (decide los precios y los productos exclusivos que ve).</li>
          <li>Después la sucursal completa el resto desde su Configuración.</li>
        </Steps>
        <Warn>
          El <K>slug</K> es la URL pública. Cambiarlo después rompe los links que
          tengas circulando. Pensá bien al darla de alta.
        </Warn>
      </Section>
    ),
  },
  {
    id: "usuarios-admin",
    title: "Usuarios admin",
    summary: "Crear cuentas master / branch_admin / staff.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Crea cuentas de admin con un rol y, si corresponde, una sucursal asignada.
          Las contraseñas se hashean con bcrypt en el server.
        </P>
        <UL>
          <li><K>master</K>: ve y edita todo, sin sucursal asignada.</li>
          <li><K>branch_admin</K>: edita SOLO su sucursal (la del campo branch_id).</li>
          <li><K>staff</K>: acceso operativo (pedidos, KDS).</li>
        </UL>
        <Tip>
          Reseteo de password: editá el usuario y poné una contraseña nueva. El usuario
          tendrá que volver a loguearse.
        </Tip>
      </Section>
    ),
  },
  {
    id: "actualizar-precios",
    title: "Actualizar precios (scraping JIRO)",
    summary: "Trae precios desde la web pública y aplica diff masivo.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          La página <strong>Actualizar precios</strong> permite scrapear los precios
          actuales de <K>jirosushi.ar</K> y compararlos contra los de nuestro catálogo.
        </P>
        <Steps>
          <li>Pegá las URLs a scrapear (o usá las del archivo por defecto).</li>
          <li>Apretá <strong>Escanear</strong>. El sistema arma 3 buckets: igual / diff / no encontrado.</li>
          <li>Revisá el diff producto por producto.</li>
          <li>
            Aplicá los cambios con <strong>Aplicar</strong>. Antes de aplicar se toma un{" "}
            <a href="#versiones-snapshots" className="text-emerald-400 hover:underline">auto-snapshot</a>
            por si querés volver atrás.
          </li>
        </Steps>
      </Section>
    ),
  },
  {
    id: "historial-precios",
    title: "Historial de precios",
    summary: "Auditoría de quién y cuándo cambió cada precio.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Cada vez que se cambia el precio de un producto (o el de una variante),
          queda registro en <K>audit_logs</K>: quién, cuándo, valor anterior y nuevo.
          Útil para detectar cambios involuntarios.
        </P>
      </Section>
    ),
  },
  {
    id: "versiones-snapshots",
    title: "Versiones (puntos de restauración)",
    summary: "Red de seguridad: volver TODA la config a un estado anterior.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Un <strong>snapshot</strong> es una foto del estado actual de toda la
          configuración: productos, promos, cupones, menús, horarios, zonas, etc.
          Los pedidos del cliente y las cuentas admin NO se incluyen.
        </P>
        <H3>Snapshots manuales</H3>
        <P>
          Andá a <strong>Versiones</strong> → <strong>+ Crear punto</strong>. Ponele
          un nombre que te ayude a recordarlo más adelante ("antes de promos del
          finde", "catálogo nuevo de mayo", etc.).
        </P>
        <H3>Snapshots automáticos</H3>
        <P>El sistema toma snapshots solo en tres casos:</P>
        <UL>
          <li><strong>Cada 24h</strong>: snapshot diario en background.</li>
          <li><strong>Antes de aplicar Actualizar precios</strong>: por si la lista scrapeada salió mal.</li>
          <li><strong>Antes del import CSV del catálogo</strong>: por si la planilla tenía un error.</li>
        </UL>
        <P>Se retienen los <strong>últimos 7 automáticos</strong>. Los manuales quedan hasta que vos los borres.</P>
        <H3>Restaurar</H3>
        <Steps>
          <li>En Versiones, apretá <strong>Restaurar</strong> en el punto que quieras.</li>
          <li>
            Confirma el mensaje (te avisa que reemplaza TODA la config, no toca
            pedidos, y crea ANTES un auto-snapshot del estado actual).
          </li>
          <li>La página se recarga sola y ya está en el estado del punto restaurado.</li>
        </Steps>
        <Tip>
          El restore es reversible: como el sistema saca un snapshot del estado
          ANTERIOR al restore, si te arrepentís, restaurás ese y volvés.
        </Tip>
        <Warn>
          El restore reemplaza productos, promos, cupones, menús, horarios y zonas
          completamente con el estado del punto. Si entre el snapshot y el restore se
          dieron de alta clientes nuevos (<K>app_users</K>), pedidos o admin nuevos,
          NO se pierden.
        </Warn>
      </Section>
    ),
  },
  {
    id: "operacion-global",
    title: "Operación global",
    summary: "Pedidos de todas las sucursales en una sola vista.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Lista cross-branch de pedidos. Útil para tener una vista de mando y filtrar
          por sucursal/fecha sin entrar uno por uno.
        </P>
      </Section>
    ),
  },
  {
    id: "recursos",
    title: "Recursos del servidor",
    summary: "Cuánta CPU, memoria y disco está usando el servidor.",
    category: "master",
    masterOnly: true,
    keywords: "cpu memoria ram disco servidor performance lento monitor salud hardware",
    body: (
      <Section>
        <P>
          Muestra el consumo del servidor donde corre la plataforma: <strong>CPU</strong>,
          <strong> memoria</strong> y <strong>disco</strong>, en porcentaje.
        </P>
        <H3>Para qué sirve</H3>
        <P>
          Es el primer lugar donde mirar si la tienda se siente lenta o si algo dejó de
          responder. Un disco cerca del 100% es el caso más grave: cuando se llena, la
          base de datos no puede escribir y <strong>se dejan de tomar pedidos</strong>.
        </P>
        <Warn>
          Si el disco pasa el 85%, avisá al equipo técnico antes de que se llene. Lo que
          más ocupa suelen ser las imágenes subidas y los puntos de restauración viejos.
        </Warn>
        <H3>Dónde se suben las imágenes</H3>
        <P>
          Acá no. La carga de imágenes está adentro de cada pantalla donde se usan:
          en <strong>Catálogo</strong> al editar un producto, y en <strong>Diseño</strong> para
          el logo, el favicon, los banners y el slider. El servidor las guarda
          bajo <K>/api/uploads/...</K>.
        </P>
        <Tip>
          Las imágenes pesadas hacen lenta la tienda y llenan el disco. Comprimilas antes
          de subirlas (TinyPNG o Squoosh, gratis y online).
        </Tip>
      </Section>
    ),
  },
  {
    id: "csv-import",
    title: "Import CSV del catálogo",
    summary: "Carga masiva de productos desde una planilla.",
    category: "master",
    masterOnly: true,
    body: (
      <Section>
        <P>
          Desde Catálogo Global, apretá <strong>Importar CSV</strong>. El parser
          detecta categorías nuevas y las crea, después crea los productos con sus
          variantes.
        </P>
        <Tip>
          Antes de importar, el sistema toma un{" "}
          <a href="#versiones-snapshots" className="text-emerald-400 hover:underline">auto-snapshot</a>
          . Si el CSV introduce errores, podés restaurar.
        </Tip>
        <H3>Formato exacto</H3>
        <P>
          Una fila por producto y <strong>12 columnas en este orden</strong>. La primera
          fila se ignora siempre (es el encabezado), así que los nombres de las columnas
          no importan — <strong>lo que importa es la posición</strong>.
        </P>
        <UL>
          <li><strong>1. categoría</strong> — obligatoria</li>
          <li><strong>2. producto</strong> — obligatorio</li>
          <li><strong>3. descripción</strong></li>
          <li><strong>4 y 5</strong> — unidad y precio de la 1ª variante</li>
          <li><strong>6 y 7</strong> — unidad y precio de la 2ª variante</li>
          <li><strong>8 y 9</strong> — unidad y precio de la 3ª variante</li>
          <li><strong>10 y 11</strong> — unidad y precio de la 4ª variante</li>
          <li><strong>12. URL de la foto</strong></li>
        </UL>
        <P>
          Las filas sin categoría o sin producto se saltean. Los precios aceptan el
          formato <K>$10.900</K>: el signo y los puntos de miles se limpian solos. Si un
          producto tiene una sola variante, dejá vacías las columnas 6 a 11.
        </P>
        <Warn>
          La <strong>columna 1 tiene que tener el nombre de la categoría, no un código</strong>.
          El importador crea una categoría nueva por cada valor distinto que encuentra
          ahí. Si el archivo trae los IDs internos de otro sistema (esos números largos
          que exportan las apps de delivery), vas a terminar con cientos de categorías
          numéricas basura en el catálogo.
        </Warn>
        <Tip>
          La categoría se busca por nombre sin distinguir mayúsculas: si ya existe
          "Rolls" y el CSV dice "rolls", usa la que ya tenías en vez de duplicarla.
        </Tip>
      </Section>
    ),
  },

  /* ────── CAMPAIGNS ────── */
  {
    id: "campanas-overview",
    title: "Campañas de WhatsApp",
    summary: "Mandar mensajes masivos a tus clientes.",
    category: "campaigns",
    body: (
      <Section>
        <P>
          Sistema de envío de mensajes por WhatsApp a una lista de contactos. Usa la
          API de Twilio detrás. Cada campaña tiene un nombre, plantilla, lista de
          destinatarios y el número desde el que se envía.
        </P>
        <H3>Estados de un mensaje</H3>
        <UL>
          <li>Pending / Sent / Delivered / Read / Failed (vienen del webhook de Twilio).</li>
        </UL>
      </Section>
    ),
  },
  {
    id: "contactos-numeros",
    title: "Contactos y Números",
    summary: "Cargar contactos por CSV. Los números solo los toca el master.",
    category: "campaigns",
    body: (
      <Section>
        <P>
          <strong>Contactos</strong>: la lista de clientes a los que vas a mandarles
          campañas. Cargá por CSV (nombre, teléfono, segmento).
        </P>
        <P>
          <strong>Números</strong> (solo master): los números remitentes habilitados en
          Twilio para enviar. Suele haber uno por marca.
        </P>
      </Section>
    ),
  },

  /* ────── GLOSSARY ────── */
  {
    id: "alertas",
    title: "Alertas",
    summary: "Panel que te avisa qué está mal configurado o trabado.",
    category: "master",
    masterOnly: true,
    keywords: "alertas salud problemas errores revisar chequeo diagnostico pendientes",
    body: (
      <Section>
        <P>
          Revisa toda la plataforma y te lista lo que está mal, agrupado por tema y por
          gravedad. Es la pantalla para abrir un lunes a la mañana antes de mirar nada más.
        </P>
        <H3>Qué detecta</H3>
        <UL>
          <li><strong>Configuración</strong>: sucursales sin WhatsApp cargado o sin zonas de envío.</li>
          <li><strong>Catálogo</strong>: productos sin precio o sin imagen, categorías vacías.</li>
          <li><strong>Promos y cupones</strong>: los que quedaron vencidos pero siguen activos.</li>
          <li><strong>Pedidos trabados</strong>: los que llevan más de 2 horas en "pendiente".</li>
        </UL>
        <Tip>
          Una sucursal sin WhatsApp cargado es la alerta más urgente: los pedidos de esa
          tienda no le llegan a nadie.
        </Tip>
      </Section>
    ),
  },
  {
    id: "maps",
    title: "Google Maps: prenderlo, apagarlo y cuánto cuesta",
    summary: "El buscador de direcciones se paga por uso. Cómo controlarlo.",
    category: "branch",
    keywords: "google maps mapa direccion buscador costo factura billing apagar prender geocoding",
    body: (
      <Section>
        <P>
          El buscador de direcciones del checkout, el mapa de sucursales y el de clientes
          usan Google Maps, que <strong>se paga por uso</strong>. Google da una cuota
          gratis por mes y a partir de ahí cobra.
        </P>

        <H3>El interruptor</H3>
        <P>
          En <strong>Configuración</strong> está el toggle del buscador de direcciones.
          Apagado, la tienda sigue funcionando perfecto: el cliente escribe la dirección
          a mano y el pedido se manda igual. Lo único que se pierde es el autocompletado
          y el chequeo de zona de envío.
        </P>
        <Warn>
          El interruptor es <strong>global</strong>, no por sucursal: apagarlo lo apaga
          para todas. Es a propósito, porque la cuenta de Google es una sola para todo
          el negocio.
        </Warn>

        <H3>Cuánto se está gastando</H3>
        <P>
          En <strong>Operación global</strong> hay un monitor con el uso estimado del mes
          y el del mes anterior. Sirve para ver la tendencia; el número exacto está en la
          consola de facturación de Google.
        </P>

        <Tip>
          Si te llega una factura alta, el sospechoso no suele ser el mapa sino las
          búsquedas de dirección. Apagá el toggle, verificá en Google de dónde vino el
          consumo, y volvé a prenderlo.
        </Tip>
      </Section>
    ),
  },
  {
    id: "revertir-precios",
    title: "Deshacer un cambio de precios",
    summary: "Volver atrás un lote completo de precios que se aplicó mal.",
    category: "master",
    masterOnly: true,
    keywords: "revertir deshacer precios lote error volver atras historial cambio masivo",
    body: (
      <Section>
        <P>
          En <strong>Historial precios</strong> los cambios aparecen agrupados
          <strong> por lote</strong>: cada vez que aplicaste una actualización masiva quedó
          un bloque con fecha, quién lo hizo y todos los productos que tocó.
        </P>
        <Steps>
          <li>Abrí <strong>Historial precios</strong>.</li>
          <li>Desplegá el lote para ver producto por producto qué precio tenía y cuál quedó.</li>
          <li>Si está mal, tocá <strong>Revertir lote</strong>.</li>
        </Steps>
        <P>
          Revertir devuelve <strong>todos</strong> los productos de ese lote al precio que
          tenían antes. No se puede revertir un producto suelto: o el lote entero, o lo
          corregís a mano desde el catálogo.
        </P>
        <Tip>
          Esto es más preciso que restaurar un punto de restauración: revertir un lote
          toca solo esos precios, mientras que restaurar una versión vuelve atrás el
          catálogo completo.
        </Tip>
      </Section>
    ),
  },
  {
    id: "recuperar-categoria",
    title: "Recuperar una categoría borrada",
    summary: "Traer de vuelta una categoría sin restaurar todo el catálogo.",
    category: "master",
    masterOnly: true,
    keywords: "recuperar categoria borrada perdida restaurar productos snapshot rescatar",
    body: (
      <Section>
        <P>
          Si borraste una categoría con sus productos, no hace falta restaurar un punto de
          restauración completo y perder todo lo que hiciste después.
        </P>
        <Steps>
          <li>Entrá a <strong>Versiones</strong>.</li>
          <li>Usá <strong>Recuperar categoría</strong>.</li>
          <li>
            Elegí la categoría: el sistema busca en qué puntos de restauración aparece y
            te dice cuántos productos tenía en cada uno.
          </li>
          <li>Elegí de qué versión traerla y confirmá.</li>
        </Steps>
        <P>
          Trae solo esa categoría y sus productos. Todo lo demás queda como está.
        </P>
      </Section>
    ),
  },
  {
    id: "carta-publica",
    title: "Modo Carta (menú de solo lectura)",
    summary: "Mostrar el menú sin opción de comprar.",
    category: "branch",
    keywords: "carta menu qr solo lectura salon mesa sin comprar catalogo publico",
    body: (
      <Section>
        <P>
          Además de la tienda, la plataforma sirve el mismo catálogo en
          <strong> modo carta</strong>: se ve el menú con precios pero sin carrito ni
          botón de comprar. Es lo que conviene poner en el QR de las mesas del salón.
        </P>
        <P>
          Se llega por <K>/carta</K> o <K>/menu</K>, y también se puede configurar un
          subdominio propio que muestre siempre la carta de una sucursal fija. Eso último
          lo configura el equipo técnico.
        </P>
        <Tip>
          Como es el mismo catálogo, cuando cambiás un precio en el admin la carta del
          salón queda actualizada al instante. No hay que reimprimir nada.
        </Tip>
      </Section>
    ),
  },
  {
    id: "glosario",
    title: "Glosario",
    summary: "Términos rápidos para entender el sistema.",
    category: "glossary",
    body: (
      <Section>
        <dl className="space-y-3">
          <div>
            <dt className="text-white font-semibold text-sm">Menú</dt>
            <dd className="text-sm text-gray-400">
              Plantilla de precios + identificador de qué productos exclusivos ve una
              sucursal. Una sucursal tiene UN menú asignado.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Producto global vs producto exclusivo</dt>
            <dd className="text-sm text-gray-400">
              Global: lo ven todas las sucursales (default). Exclusivo: solo aparece
              en sucursales con uno de los menús asignados.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Override</dt>
            <dd className="text-sm text-gray-400">
              Sobreescritura por sucursal sobre un producto global: cambiar disponibilidad
              o forzar un precio puntual sin tocar el catálogo global.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Scope de una promo o cupón</dt>
            <dd className="text-sm text-gray-400">
              "Aplica a" todos / categorías / productos. Limita qué items reciben el
              descuento.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Snapshot</dt>
            <dd className="text-sm text-gray-400">
              Foto de toda la configuración (catálogo, promos, cupones, etc.) en un
              momento dado. Permite restaurar.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Master vs Branch</dt>
            <dd className="text-sm text-gray-400">
              Master administra TODO el sistema. Branch admin solo su sucursal. Staff
              solo operativa (pedidos / KDS).
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">2x1 (same_product_quantity)</dt>
            <dd className="text-sm text-gray-400">
              Tipo de promo donde cada par (o N-tupla) del mismo producto en el carrito
              recibe descuento. Las sobrantes pagan precio lleno.
            </dd>
          </div>
          <div>
            <dt className="text-white font-semibold text-sm">Storefront</dt>
            <dd className="text-sm text-gray-400">
              El sitio público de cada sucursal donde el cliente arma el pedido.
            </dd>
          </div>
        </dl>
      </Section>
    ),
  },
];

/* ──────────────────────────────────────────────────
   PÁGINA
   ────────────────────────────────────────────────── */

export default function HelpPage() {
  const { user } = useAuth();
  const isMaster = user?.role === "master";

  // Filtrar secciones según rol.
  const visible = useMemo(
    () => SECTIONS.filter((s) => !s.masterOnly || isMaster),
    [isMaster]
  );

  // Sección activa: arranca con el hash o con la primera visible.
  const [activeId, setActiveId] = useState<string>(() => {
    const hash = (typeof window !== "undefined" ? window.location.hash : "").replace(
      "#",
      ""
    );
    if (hash && visible.some((s) => s.id === hash)) return hash;
    return visible[0]?.id || "que-es";
  });

  // Buscador del índice.
  const [search, setSearch] = useState("");

  // Sincronizar hash cuando cambia la sección.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeId && window.location.hash !== `#${activeId}`) {
      history.replaceState(null, "", `#${activeId}`);
    }
  }, [activeId]);

  // Escuchar cambios externos del hash (links internos).
  useEffect(() => {
    function onHashChange() {
      const h = window.location.hash.replace("#", "");
      if (h && visible.some((s) => s.id === h)) setActiveId(h);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [visible]);

  // Capturar clicks en <a href="#otra-seccion"> dentro del body para que cambien el activeId.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const a = t.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) {
        const id = href.slice(1);
        if (visible.some((s) => s.id === id)) {
          e.preventDefault();
          setActiveId(id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    }
    const root = document.getElementById("help-body-root");
    root?.addEventListener("click", onClick);
    return () => root?.removeEventListener("click", onClick);
  }, [visible]);

  const matchSearch = (s: HelpSection) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      (s.keywords || "").toLowerCase().includes(q)
    );
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABEL[cat],
    items: visible.filter((s) => s.category === cat && matchSearch(s)),
  })).filter((g) => g.items.length > 0);

  const active = visible.find((s) => s.id === activeId) || visible[0];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Ayuda</h2>
        <p className="text-sm text-gray-400">
          Manual del sistema · Tu rol:{" "}
          <span className="text-emerald-400 font-medium">
            {isMaster ? "Master" : user?.role === "branch_admin" ? "Admin de sucursal" : "Staff"}
          </span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Índice */}
        <aside className="lg:w-72 shrink-0">
          <div className="lg:sticky lg:top-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar tema…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <div className="mt-3 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto space-y-3">
              {grouped.map((g) => (
                <div key={g.cat}>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {g.label}
                  </p>
                  <div className="space-y-0.5">
                    {g.items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveId(s.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                          activeId === s.id
                            ? "bg-emerald-600/20 text-emerald-300"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                        }`}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {grouped.length === 0 && (
                <p className="text-xs text-gray-500 px-2 py-4 text-center">
                  No hay temas que coincidan con "{search}".
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <div className="flex-1 min-w-0" id="help-body-root">
          {active && (
            <article className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-7">
              <header className="mb-4 pb-4 border-b border-gray-800">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{active.title}</h1>
                <p className="text-sm text-gray-400 mt-1">{active.summary}</p>
              </header>
              <div className="prose-help">{active.body}</div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
