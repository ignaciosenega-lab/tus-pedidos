import { useState, useMemo, useEffect, useRef } from "react";
import type { Product } from "./types";
import { useCartDispatch } from "./store/cartContext";
import { useStorefront } from "./hooks/useStorefront";

import HeaderBar from "./components/HeaderBar";
import CategoryChips from "./components/CategoryChips";
import SearchAndSort from "./components/SearchAndSort";
import ProductCard from "./components/ProductCard";
import ProductOptionsModal from "./components/ProductOptionsModal";
import CartModal from "./components/CartModal";
import CheckoutModal from "./components/CheckoutModal";
import OutOfStockModal from "./components/OutOfStockModal";
import StoreClosedBanner from "./components/StoreClosedBanner";
import ThemeStyles from "./components/ThemeStyles";
import BranchSelectorPage from "./components/BranchSelectorPage";

type SortOption = "default" | "price-asc" | "price-desc" | "name";

function getProductPrice(p: Product): number {
  if (p.type === "simple") return p.basePrice ?? 0;
  return p.variants?.[0]?.price ?? 0;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("_tp_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_tp_sid", sid);
  }
  return sid;
}

function trackEvent(branchId: number, eventType: string, productId?: string) {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, eventType, productId, sessionId: getSessionId() }),
  }).catch(() => {});
}

export default function App() {
  const dispatch = useCartDispatch();
  const { products: adminProducts, categories: adminCategories, businessConfig, isMaster, loading, branchId } = useStorefront();

  // Track session once per page load
  const sessionTracked = useRef(false);
  useEffect(() => {
    if (branchId && !sessionTracked.current) {
      sessionTracked.current = true;
      trackEvent(branchId, "session");
    }
  }, [branchId]);

  // Only show active (alta), non-private products
  const products: Product[] = useMemo(
    () => adminProducts.filter((p) => p.status === "alta" && !p.private),
    [adminProducts]
  );

  // Only show categories that have at least one visible product, prepend "Todo"
  const visibleCategories = useMemo(() => {
    const productCategoryIds = new Set(products.map((p) => p.categoryId));
    const hasSinTacc = products.some((p) => p.badges?.includes("sin_tacc"));
    const filtered = adminCategories.filter((cat) => {
      if (cat.id === "all") return false; // skip if it comes from DB, we add it manually
      if (cat.id === "sin-tacc") return hasSinTacc;
      return productCategoryIds.has(cat.id);
    });
    return [{ id: "all", name: "Todo" }, ...filtered];
  }, [adminCategories, products]);

  // UI state
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");

  // Modals
  const [optionsProduct, setOptionsProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Filter + sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (selectedCategory === "sin-tacc") {
      result = result.filter((p) => p.badges?.includes("sin_tacc"));
    } else if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sort) {
      case "price-asc":
        result.sort((a, b) => getProductPrice(a) - getProductPrice(b));
        break;
      case "price-desc":
        result.sort((a, b) => getProductPrice(b) - getProductPrice(a));
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, selectedCategory, search, sort]);

  function handleAddSimple(product: Product) {
    if (product.type === "simple" && product.stock !== undefined && product.stock <= 0) {
      setShowOutOfStock(true);
      return;
    }

    if (branchId) trackEvent(branchId, "product_view", product.id);

    dispatch({
      type: "ADD_ITEM",
      payload: {
        productId: product.id,
        productName: product.name,
        price: product.basePrice!,
        quantity: 1,
        imageUrl: product.imageUrl,
        description: product.description,
      },
    });
    setShowCart(true);
  }

  function handleOpenOptions(product: Product) {
    if (branchId) trackEvent(branchId, "product_view", product.id);
    setOptionsProduct(product);
  }

  function handleOpenCheckout() {
    if (branchId) trackEvent(branchId, "checkout_start");
    setShowCart(false);
    setShowCheckout(true);
  }

  // Master domain: show branch selector instead of storefront
  if (!loading && isMaster) {
    return <BranchSelectorPage />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--body-bg)", color: "var(--general-text)" }}>
      <ThemeStyles />
      <HeaderBar onOpenCart={() => setShowCart(true)} />

      {!businessConfig.isOpen && (
        <StoreClosedBanner
          nextOpenTime={businessConfig.nextOpenTime}
          holidayReason={businessConfig.holidayReason}
        />
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        {/* Title */}
        <section className="mt-6 mb-6">
          <h1 className="text-3xl font-extrabold italic" style={{ color: "var(--title-text)" }}>
            Nuestro Menú
          </h1>
          <p className="mt-1 opacity-70" style={{ color: "var(--general-text)" }}>
            {businessConfig.description || "Explorá nuestro menú completo"}
          </p>
        </section>

        {/* Categories */}
        <section className="mt-4">
          <CategoryChips
            categories={visibleCategories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </section>

        {/* Search and sort */}
        <section className="mt-4">
          <SearchAndSort
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
        </section>

        {/* Products grid */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 opacity-50">
              No se encontraron productos
            </div>
          ) : (
            filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOptions={handleOpenOptions}
                onAdd={handleAddSimple}
              />
            ))
          )}
        </section>
      </main>

      {/* Modals */}
      {optionsProduct && (
        <ProductOptionsModal
          product={optionsProduct}
          onClose={() => setOptionsProduct(null)}
          onOutOfStock={() => {
            setOptionsProduct(null);
            setShowOutOfStock(true);
          }}
          onAdded={() => setShowCart(true)}
        />
      )}

      {showCart && (
        <CartModal
          onClose={() => setShowCart(false)}
          onCheckout={handleOpenCheckout}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          isStoreOpen={businessConfig.isOpen}
        />
      )}

      {showOutOfStock && (
        <OutOfStockModal onClose={() => setShowOutOfStock(false)} />
      )}

    </div>
  );
}
