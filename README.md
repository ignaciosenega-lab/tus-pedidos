# Tus Pedidos

Sitio de pedidos para un local gastronómico con catálogo de productos, carrito de compras y checkout vía WhatsApp.

## Stack

- Vite + React + TypeScript
- TailwindCSS
- Context + Reducer (estado global)
- LocalStorage (persistencia del carrito)
- Google Maps JavaScript API + Places Autocomplete

## Requisitos

- Node.js >= 18
- npm >= 9

## Instalación

```bash
npm install
```

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## Build para producción

```bash
npm run build
```

Los archivos se generan en la carpeta `dist/`.

## Configurar Google Maps

1. Crear un archivo `.env` en la raíz del proyecto (podés copiar `.env.example`):

```bash
cp .env.example .env
```

2. Reemplazar el valor de `VITE_GOOGLE_MAPS_KEY` con tu API key de Google Maps:

```env
VITE_GOOGLE_MAPS_KEY=AIzaSy...tu_key_aqui
```

3. La API key debe tener habilitadas las APIs:
   - Maps JavaScript API
   - Places API

> Si no configurás la key, el mapa mostrará un placeholder gris indicando que falta la configuración.

## Personalización

### Teléfono del local

Modificar `phone` en `src/data/seed.ts` → `storeConfig`:

```ts
export const storeConfig: StoreConfig = {
  phone: "5491165884326", // ← cambiar aquí
  // ...
};
```

### Dirección del local

Modificar `address` y `addressUrl` en el mismo `storeConfig`:

```ts
export const storeConfig: StoreConfig = {
  address: "Av. Rivadavia 9833, Liniers", // ← cambiar aquí
  addressUrl: "https://maps.google.com/?q=...", // ← cambiar aquí
  // ...
};
```

### Productos y categorías

Editar los arrays `categories` y `products` en `src/data/seed.ts`.

Cada producto tiene la estructura:

```ts
{
  id: string,
  name: string,
  description: string,
  categoryId: string,        // debe coincidir con un id de categories
  imageUrl: string,
  type: "options" | "simple",
  basePrice?: number,        // solo para type "simple"
  stock?: number,            // solo para type "simple"
  variants?: Variant[],      // solo para type "options"
  badges?: ("sin_tacc" | "nuevo")[],
}
```

### Estado abierto/cerrado

Cambiar `isOpen` en `storeConfig`:

```ts
export const storeConfig: StoreConfig = {
  isOpen: true, // ← false para mostrar banner de cerrado
  // ...
};
```

### Imagen de local cerrado

Reemplazar `public/jiro_cerrado.png` con tu propia imagen. Se recomienda una imagen de al menos 400px de ancho en formato PNG o JPG.

## Estructura del proyecto

```
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.cjs
├── tsconfig.json
├── .env.example
├── public/
│   └── jiro_cerrado.png
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types.ts
    ├── vite-env.d.ts
    ├── styles/
    │   └── globals.css
    ├── data/
    │   └── seed.ts
    ├── store/
    │   └── cartContext.tsx
    ├── utils/
    │   ├── money.ts
    │   ├── whatsapp.ts
    │   └── dateTime.ts
    └── components/
        ├── HeaderBar.tsx
        ├── CategoryChips.tsx
        ├── SearchAndSort.tsx
        ├── ProductCard.tsx
        ├── ProductOptionsModal.tsx
        ├── CartModal.tsx
        ├── CheckoutModal.tsx
        ├── OutOfStockModal.tsx
        ├── StoreClosedBanner.tsx
        └── GoogleAddressPicker.tsx
```
