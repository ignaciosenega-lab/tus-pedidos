import { useState, useEffect } from "react";
import type { AdminProduct, Category, BusinessConfig, StyleConfig, ActivePromotion, DeliveryZone } from "../types";

interface StorefrontData {
  branchId: number | null;
  isMaster: boolean;
  branchDomain: string;
  products: AdminProduct[];
  categories: Category[];
  activePromotions: ActivePromotion[];
  deliveryZones: DeliveryZone[];
  businessConfig: BusinessConfig;
  styleConfig: StyleConfig;
  loading: boolean;
}

const defaultConfig: BusinessConfig = {
  title: "TusPedidos",
  email: "",
  address: "",
  addressUrl: "",
  url: "",
  description: "",
  phone: "",
  isOpen: true,
  logo: "",
  favicon: "",
  banners: [],
  whatsapp: "",
  socialLinks: [],
  sliderImages: [],
};

const defaultStyleConfig: StyleConfig = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontUrl: "",
  headerBg: "#111827",
  headerText: "#ffffff",
  menuBg: "#111827",
  menuText: "#d1d5db",
  bodyBg: "#000000",
  panelBg: "#1f2937",
  popupBg: "#111827",
  generalText: "#d1d5db",
  titleText: "#ffffff",
  buttonBg: "#10b981",
  buttonText: "#ffffff",
  footerEnabled: false,
  footerBg: "#111827",
  footerText: "#9ca3af",
};

export { defaultStyleConfig };

export function useStorefront(): StorefrontData {
  const [data, setData] = useState<StorefrontData>({
    branchId: null,
    isMaster: false,
    branchDomain: "",
    products: [],
    categories: [],
    activePromotions: [],
    deliveryZones: [],
    businessConfig: defaultConfig,
    styleConfig: defaultStyleConfig,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((state) => {
        if (!state) {
          setData((prev) => ({ ...prev, loading: false }));
          return;
        }

        const sc = typeof state.styleConfig === "object" && state.styleConfig
          ? state.styleConfig
          : {};

        // Master domain: no branch loaded, just styling info
        if (state.isMaster) {
          setData({
            branchId: null,
            isMaster: true,
            branchDomain: state.branchDomain || "",
            products: [],
            categories: [],
            activePromotions: [],
            deliveryZones: [],
            businessConfig: { ...defaultConfig, ...(state.businessConfig || {}) },
            styleConfig: { ...defaultStyleConfig, ...sc },
            loading: false,
          });
          return;
        }

        setData({
          branchId: state.branchId || null,
          isMaster: false,
          branchDomain: "",
          products: state.products || [],
          categories: state.categories || [],
          activePromotions: state.activePromotions || [],
          deliveryZones: state.deliveryZones || [],
          businessConfig: state.businessConfig || defaultConfig,
          styleConfig: { ...defaultStyleConfig, ...sc },
          loading: false,
        });
      })
      .catch(() => {
        setData((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  return data;
}
