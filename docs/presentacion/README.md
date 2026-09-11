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
- **"24/7 tomando pedidos"** — con el local cerrado se muestra el cartel de
  reapertura y no se toman pedidos.
- **"Se prende en una tarde"** — o se ponen días hábiles concretos o no se dice.
- **Cualquier comisión presentada como dato de mercado** — los porcentajes de la
  página 10 son un ejemplo y están rotulados como tal. No se toca esa nota.
- **"App"** — es una web. No hay PWA ni nada instalable.
- **"Control de stock"** — hay un campo, pero no descuenta solo.
- **"Auditoría"** a secas — solo cubre cambios de precio.
- **Campañas de WhatsApp** — fuera del deck por ahora, hasta definir si se cobran
  aparte (Twilio cobra por mensaje enviado).
- **Pagos online** — no hay pasarela. El pago se arregla por fuera.
- **MegaFody** — es un prototipo que pierde los datos al refrescar. No es un POS y
  no se menciona.

## Dos cosas que no son decorativas

**La página 11 va en blanco a propósito.** Es la planilla que se completa a mano
delante del comercio, con SUS números. Es más convincente que cualquier porcentaje
que pongamos nosotros, y evita afirmar una comisión de mercado que no podemos
respaldar.

**Las dos notas al pie de la página 10 no se sacan.** La segunda —que la cuenta vale
para los pedidos que ya son del comercio, porque las apps además traen clientes
nuevos y ponen el cadete— es la que sostiene la credibilidad de toda la diapositiva.
Dicha por nosotros primero, nos deja como los que juegan limpio; si la dice el
comprador, perdimos el argumento.
