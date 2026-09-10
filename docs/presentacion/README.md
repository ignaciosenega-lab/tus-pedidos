# Presentación de venta

Material para presentarle la plataforma a los franquiciados.

- `presentacion-venta.html` — la fuente. Es un HTML paginado, una `<section class="page">` por hoja.
- `tus-pedidos-presentacion.pdf` — el PDF generado, A4 apaisado, 10 páginas.

## Editarlo

Abrí el HTML en el navegador y vas a ver las páginas una abajo de la otra, tal
cual salen impresas. Editá el texto y volvé a generar el PDF.

## Regenerar el PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/presentacion/tus-pedidos-presentacion.pdf" \
  "file://$PWD/docs/presentacion/presentacion-venta.html"
```

## Qué NO poner acá

La presentación solo menciona funciones que existen y andan. Al día de hoy
quedan afuera a propósito:

- **MegaFody** — es un prototipo: el estado vive en memoria, no se guarda nada
  y los pedidos se pierden al refrescar la página. No es un POS todavía.
- **Pagos online** — no hay integración con ninguna pasarela. El pago se
  arregla por fuera (efectivo o transferencia).
- **App instalable / PWA** — no existe. Es una web, muy rápida, pero web.
- **Control de stock** — hay un campo de stock pero no descuenta solo.
- **Auditoría completa** — solo se auditan los cambios de precio, no el resto
  del sistema.

Si alguna de estas se implementa de verdad, actualizá el deck y borrá la línea
de esta lista.

## La página 3

La tabla de "Poné tus números" está en blanco a propósito: se completa a mano
delante del franquiciado, con SUS números. Es más convincente que cualquier
porcentaje que pongamos nosotros, y evita afirmar una comisión que no podemos
respaldar.
