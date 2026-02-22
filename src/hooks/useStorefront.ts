import { useState, useEffect } from "react";
import type { AdminProduct, Category, BusinessConfig, StyleConfig } from "../types";

interface StorefrontData {
  products: AdminProduct[];
  categories: Category[];
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
    products: [],
    categories: [],
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
        setData({
          products: state.products || [],
          categories: state.categories || [],
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
