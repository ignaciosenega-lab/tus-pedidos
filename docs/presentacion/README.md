# Presentación de venta — TusPedidos.ar

- `presentacion-venta.html` — la fuente. Una `<section class="page">` por hoja, 13 en total.
  Las imágenes van embebidas en el propio archivo, así que es autocontenido: se puede
  abrir en cualquier navegador y mandar por mail sin adjuntos sueltos.
- `TusPedidos-Presentacion.pdf` — A4 apaisado, 13 páginas.

También está publicada como página web, que es lo que conviene mandar por WhatsApp
porque en el celular las páginas se leen de corrido en vez de quedar diminutas.

## Editarla

Abrí el HTML en el navegador y vas a ver las páginas una abajo de la otra, tal cual
salen impresas. Editás el texto y regenerás el PDF.

## Regenerar el PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/presentacion/TusPedidos-Presentacion.pdf" \
  "file://$PWD/docs/presentacion/presentacion-venta.html"
```

## Lo que falta completar

Están marcados en amarillo dentro de la página 12, para que no pasen por texto
definitivo:

- Horario y tiempo de respuesta del soporte.
- Cada cuánto y con cuánto aviso se ajusta el precio por IPC.
- Cuántos días hábiles tarda el alta.

## Lo que NO se puede afirmar

Cada una de estas se verificó contra el código y **no es cierta hoy**. Si alguna se
implementa de verdad, actualizá el deck y borrá la línea de esta lista.

- **"Cola de pedidos en vivo" / "en tiempo real" / "se actualiza sola" / "suena"** —
  `OperationsPage.tsx` no tiene ningún `setInterval`: la pantalla se refresca con el
  botón *Actualizar*. El aviso instantáneo es el WhatsApp, y así está contado en la
  página 4.
- **"Exportar la base de clientes"** — no existe el botón. Hay import de contactos,
  no export. Por eso la página 13 dice "te lo damos cuando lo pidas" y no promete
  una descarga.
- **"24/7" / "a cualquier hora"** — es más sutil de lo que parece. Con el local
  cerrado *por horario* el cliente **sí puede** pedir: `isStoreOpen` llega al
  `CheckoutModal` y nunca se consulta, y el cartel invita a "PROGRAMÁ TU PEDIDO".
  Lo que **sí** bloquea el carrito es la **pausa por alta demanda**
  (`App.tsx:195-198`). Como las dos cosas conviven, no se afirma ninguna de las
  dos en el deck: el argumento que siempre es cierto es *"no depende de que
  alguien le conteste"*.

- **"Banners"** — existe un campo `banners` en el admin (`StylesPage`) que
  **ningún componente de la tienda dibuja**: fuera del admin solo aparece el
  default `[]` en `useStorefront.ts:35`. Lo que el cliente sí ve es el carrusel
  *Promociones del Día*, que aparece solo cuando hay promociones activas. El
  deck usa el carrusel y no menciona la palabra "banners".
- **"Se prende en una tarde"** — o se ponen días hábiles concretos o no se dice.
- **Cualquier comisión presentada como dato de mercado** — los porcentajes de la
  página 10 son un ejemplo y están rotulados como tal. No se toca esa nota.
- **"App"** — es una web. No hay PWA ni nada instalable.
- **"Control de stock"** — hay un campo, pero no descuenta solo.
- **"Auditoría"** a secas — solo cubre cambios de precio.
- **Campañas de WhatsApp** — fuera del deck por ahora, hasta definir si se cobran
  aparte (Twilio cobra por mensaje enviado).

- **Tiempos de entrega** — no hay ETA, ni contador, ni seguimiento del pedido.
  La demora de cocina filtra las franjas por detrás pero nunca se le muestra al
  cliente. Eso es una virtud y así está contado en la página 3: *"nunca podés
  llegar tarde a un tiempo que no prometiste"*. Que nadie le agregue "en
  minutos" después.

- **El desplegable de horarios** — las franjas están fijas de 19:00 a 22:45
  (`dateTime.ts:41`). Por eso ninguna captura lo muestra abierto: a un local que
  vende al mediodía lo dejaría sin horarios. Decisión del dueño: no se toca por
  ahora.
- **Pagos online** — no hay pasarela. El pago se arregla por fuera.
- **MegaFody** — es un prototipo que pierde los datos al refrescar. No es un POS y
  no se menciona.

## Las capturas

Los mockups salen de la base **local**, sembrada con el catálogo real de
producción (nombres, precios y fotos públicas) mediante `scratchpad/seed-deck.js`.
Nunca del panel de producción, que tiene teléfonos y direcciones de clientes
reales en un documento que va a circular por WhatsApp.

Todo el deck cuenta **un solo pedido**: Harumakis $13.610 + Croquetas de salmón
$17.770 = **$31.380**, que con el 10% queda en **$28.242**. El cupón y la ruleta
dan exactamente el mismo total, y eso es lo que sostiene el argumento de la
página 5: son tres caminos al mismo destino, nunca tres descuentos sumados.

## Tres cosas que no son decorativas

**La página 11 va en blanco a propósito.** Es la planilla que se completa a mano
delante del comercio, con SUS números. Es más convincente que cualquier porcentaje
que pongamos nosotros, y evita afirmar una comisión de mercado que no podemos
respaldar.

**Las dos notas al pie de la página 10 no se sacan.** La segunda —que la cuenta vale
para los pedidos que ya son del comercio, porque las apps además traen clientes
nuevos y ponen el cadete— es la que sostiene la credibilidad de toda la diapositiva.
Dicha por nosotros primero, nos deja como los que juegan limpio; si la dice el
comprador, perdimos el argumento.


**Los tres celulares de la página 5 son de tres clientes distintos.** La frase
está escrita en la página y no se saca: la ruleta solo se le ofrece a quien no
tiene ningún otro descuento (`CheckoutModal.tsx:89-92`), así que mostrar las tres
pantallas sin aclararlo sugeriría que se apilan, que es justo lo contrario de
como funciona.
