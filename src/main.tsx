import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./store/cartContext";
import { AuthProvider, useAuth } from "./store/authContext";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import AdminLayout from "./pages/AdminLayout";
import LoginPage from "./pages/LoginPage";
import CatalogPage from "./pages/admin/CatalogPage";
import BranchesPage from "./pages/admin/BranchesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AuditPage from "./pages/admin/AuditPage";
import PriceScanPage from "./pages/admin/PriceScanPage";
import PromotionsPage from "./pages/admin/PromotionsPage";
import CouponsPage from "./pages/admin/CouponsPage";
import UsersPage from "./pages/admin/UsersPage";
import ConfigPage from "./pages/admin/ConfigPage";
import OperationsPage from "./pages/admin/OperationsPage";
import StylesPage from "./pages/admin/StylesPage";
import DeliveryZonesPage from "./pages/admin/DeliveryZonesPage";
import MenusPage from "./pages/admin/MenusPage";
import ResourcesPage from "./pages/admin/ResourcesPage";
import MetricsPage from "./pages/admin/MetricsPage";
import GlobalOperationsPage from "./pages/admin/GlobalOperationsPage";
import AlertsPage from "./pages/admin/AlertsPage";
import SnapshotsPage from "./pages/admin/SnapshotsPage";
import HelpPage from "./pages/admin/HelpPage";
import MegaFodyLayout from "./pages/admin/megafody/MegaFodyLayout";
import MegaFodyHome from "./pages/admin/megafody/MegaFodyHome";
import DeliveryPage from "./pages/admin/megafody/DeliveryPage";
import KdsPage from "./pages/admin/megafody/KdsPage";
import CampaignsPage from "./pages/admin/CampaignsPage";
import CampaignContactsPage from "./pages/admin/CampaignContactsPage";
import CampaignNumbersPage from "./pages/admin/CampaignNumbersPage";
import "./styles/globals.css";

function MasterOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "master") {
    return (
      <div className="max-w-4xl">
        <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-yellow-400 font-medium text-lg">No tenés permisos para esta sección</p>
          <p className="text-yellow-500/70 text-sm mt-1">Esta opción es exclusiva del administrador master.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            {/* Storefront */}
            <Route path="/" element={<App />} />

            {/* Carta / menú público de solo lectura (sin compra) — misma sucursal
                que la tienda (se resuelve por subdominio), solo cambia el modo. */}
            <Route path="/carta" element={<App menuOnly />} />
            <Route path="/menu" element={<App menuOnly />} />

            {/* Admin login */}
            <Route path="/admin/login" element={<LoginPage />} />

            {/* Admin / Backoffice (protected) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="catalogo" replace />} />
              {/* Shared (role-aware internally) */}
              <Route path="catalogo" element={<CatalogPage />} />
              <Route path="clientes" element={<UsersPage />} />
              {/* Master-only routes */}
              <Route path="sucursales" element={<MasterOnly><BranchesPage /></MasterOnly>} />
              <Route path="menus" element={<MasterOnly><MenusPage /></MasterOnly>} />
              <Route path="usuarios" element={<MasterOnly><AdminUsersPage /></MasterOnly>} />
              <Route path="auditoria" element={<MasterOnly><AuditPage /></MasterOnly>} />
              <Route path="versiones" element={<MasterOnly><SnapshotsPage /></MasterOnly>} />
              <Route path="ayuda" element={<HelpPage />} />
              <Route path="actualizar-precios" element={<MasterOnly><PriceScanPage /></MasterOnly>} />
              <Route path="recursos" element={<MasterOnly><ResourcesPage /></MasterOnly>} />
              <Route path="operacion-global" element={<MasterOnly><GlobalOperationsPage /></MasterOnly>} />
              <Route path="alertas" element={<MasterOnly><AlertsPage /></MasterOnly>} />
              <Route path="megafody" element={<MasterOnly><MegaFodyLayout /></MasterOnly>}>
                <Route index element={<MegaFodyHome />} />
                <Route path="delivery" element={<DeliveryPage />} />
                <Route path="kds" element={<KdsPage />} />
              </Route>
              {/* Branch routes */}
              <Route path="promociones" element={<PromotionsPage />} />
              <Route path="cupones" element={<CouponsPage />} />
              <Route path="configuracion" element={<ConfigPage />} />
              <Route path="operacion" element={<OperationsPage />} />
              <Route path="estilos" element={<MasterOnly><StylesPage /></MasterOnly>} />
              <Route path="zonas-envio" element={<DeliveryZonesPage />} />
              <Route path="metricas" element={<MetricsPage />} />
              {/* Campaigns */}
              <Route path="campanas" element={<CampaignsPage />} />
              <Route path="contactos-campana" element={<CampaignContactsPage />} />
              <Route path="numeros-campana" element={<MasterOnly><CampaignNumbersPage /></MasterOnly>} />
            </Route>
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  </StrictMode>
);
