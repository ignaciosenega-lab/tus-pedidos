import { useState, useEffect } from "react";
import type { AdminProduct, Category, BusinessConfig } from "../types";

interface StorefrontData {
  products: AdminProduct[];
  categories: Category[];
  businessConfig: BusinessConfig;
  loading: boolean;
}

const defaultConfig: BusinessConfig = {
  name: "TusPedidos",
  whatsapp: "",
  address: "",
  logo: "",
  isOpen: true,
  deliveryFee: 0,
  minOrderAmount: 0,
  estimatedDeliveryTime: "30-45 min",
  schedule: [],
  paymentMethods: [],
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
