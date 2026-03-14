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
import PromoBanner from "./components/PromoBanner";
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
  const { products: adminProducts, categories: adminCategories, activePromotions, businessConfig, isMaster, loading, branchId } = useStorefront();

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
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name: string; discount: number } | null>(null);

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

      {(() => {
        const pausedUntil = (businessConfig as any).pausedUntil;
        const isPaused = pausedUntil && new Date(pausedUntil) > new Date();
        const showBanner = !businessConfig.isOpen || isPaused;
        if (!showBanner) return null;
        return (
          <StoreClosedBanner
            nextOpenTime={isPaused ? pausedUntil : businessConfig.nextOpenTime}
            holidayReason={businessConfig.holidayReason}
            closedReason={isPaused ? "paused" : businessConfig.closedReason}
          />
        );
      })()}

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

        {/* Promo banner */}
        {activePromotions.length > 0 && (
          <section className="mt-4">
            <PromoBanner promotions={activePromotions} />
          </section>
        )}

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
          onClose={() => { setShowCart(false); setAppliedCoupon(null); }}
          onCheckout={handleOpenCheckout}
          appliedCoupon={appliedCoupon}
          onApplyCoupon={setAppliedCoupon}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          onClose={() => { setShowCheckout(false); setAppliedCoupon(null); }}
          isStoreOpen={businessConfig.isOpen}
          appliedCoupon={appliedCoupon}
        />
      )}

      {showOutOfStock && (
        <OutOfStockModal onClose={() => setShowOutOfStock(false)} />
      )}

      {/* Floating WhatsApp button */}
      {(businessConfig.whatsapp || businessConfig.phone) && (
        <a
          href={`https://api.whatsapp.com/send?phone=${(businessConfig.whatsapp || businessConfig.phone).replace(/\D/g, "")}&text=${encodeURIComponent("Hola, tuve un problema para hacer mi pedido.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#25D366] rounded-full shadow-lg hover:scale-105 transition-transform pl-4 pr-3 py-2.5"
          aria-label="Contactar por WhatsApp"
        >
          <span className="text-white text-xs font-medium hidden sm:inline">Tuve un problema con mi pedido</span>
          <span className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </span>
        </a>
      )}

    </div>
  );
}
