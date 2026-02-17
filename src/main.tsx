import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./store/cartContext";
import { AuthProvider } from "./store/authContext";
import App from "./App";
import AdminLayout from "./pages/AdminLayout";
import LoginPage from "./pages/LoginPage";
import CatalogPage from "./pages/admin/CatalogPage";
import BranchesPage from "./pages/admin/BranchesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AuditPage from "./pages/admin/AuditPage";
import PromotionsPage from "./pages/admin/PromotionsPage";
import CouponsPage from "./pages/admin/CouponsPage";
import UsersPage from "./pages/admin/UsersPage";
import ConfigPage from "./pages/admin/ConfigPage";
import OperationsPage from "./pages/admin/OperationsPage";
import StylesPage from "./pages/admin/StylesPage";
import DeliveryZonesPage from "./pages/admin/DeliveryZonesPage";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Storefront */}
            <Route path="/" element={<App />} />

            {/* Admin login */}
            <Route path="/admin/login" element={<LoginPage />} />

            {/* Admin / Backoffice (protected) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="catalogo" replace />} />
              {/* Master admin routes */}
              <Route path="catalogo" element={<CatalogPage />} />
              <Route path="sucursales" element={<BranchesPage />} />
              <Route path="usuarios" element={<AdminUsersPage />} />
              <Route path="clientes" element={<UsersPage />} />
              <Route path="auditoria" element={<AuditPage />} />
              {/* Legacy/placeholder routes */}
              <Route path="promociones" element={<PromotionsPage />} />
              <Route path="cupones" element={<CouponsPage />} />
              <Route path="configuracion" element={<ConfigPage />} />
              <Route path="operacion" element={<OperationsPage />} />
              <Route path="estilos" element={<StylesPage />} />
              <Route path="zonas-envio" element={<DeliveryZonesPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  </StrictMode>
);
