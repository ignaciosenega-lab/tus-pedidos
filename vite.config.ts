import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Transpila la sintaxis moderna (??, ?., spread, etc.) a ES2015 para que el
  // bundle corra en navegadores/WebViews viejos (Android antiguo, navegadores
  // in-app, iOS viejo). Sin esto, Vite 6 compila para navegadores modernos y
  // los celulares viejos ven "pantalla en negro" (React no llega a montar).
  build: { target: "es2015" },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
