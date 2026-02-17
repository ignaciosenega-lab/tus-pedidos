import { useState, useEffect } from "react";
import type { AdminProduct, Category, BusinessConfig } from "../types";

interface StorefrontData {
  products: AdminProduct[];
  categories: Category[];
  businessConfig: BusinessConfig;
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

export function useStorefront(): StorefrontData {
  const [data, setData] = useState<StorefrontData>({
    products: [],
    categories: [],
    businessConfig: defaultConfig,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((state) => {
        setData({
          products: state.products || [],
          categories: state.categories || [],
          businessConfig: state.businessConfig || defaultConfig,
          loading: false,
        });
      })
      .catch(() => {
        setData((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  return data;
}
