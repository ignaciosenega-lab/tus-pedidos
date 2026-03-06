import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { Product, Category, ActivePromotion } from "./types";
import { useCartDispatch } from "./store/cartContext";
import { useStorefront } from "./hooks/useStorefront";

import HeaderBar from "./components/HeaderBar";
import CategoryTabs from "./components/CategoryTabs";
import SearchAndSort from "./components/SearchAndSort";
import ProductCard from "./components/ProductCard";
import PromoBanner from "./components/PromoBanner";
import ProductOptionsModal from "./components/ProductOptionsModal";
import CartModal from "./components/CartModal";
import CheckoutModal from "./components/CheckoutModal";
import OutOfStockModal from "./components/OutOfStockModal";
import StoreClosedBanner from "./components/StoreClosedBanner";
import ThemeStyles from "./components/ThemeStyles";
import BranchSelectorPage from "./components/BranchSelectorPage";

type SortOption = "default" | "price-asc" | "price-desc" | "name";

type Section =
  | { type: "category"; category: Category; products: Product[] }
  | { type: "promo"; promotion: ActivePromotion };

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
  const {
    products: adminProducts,
    categories: adminCategories,
    activePromotions,
    businessConfig,
    isMaster,
    loading,
    branchId,
  } = useStorefront();

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

  // Categories that have at least one visible product (no "all" entry)
  const visibleCategories = useMemo(() => {
    const productCategoryIds = new Set(products.map((p) => p.categoryId));
    return adminCategories.filter((cat) => {
      if (cat.id === "all" || cat.id === "sin-tacc") return false;
      return productCategoryIds.has(cat.id);
    });
  }, [adminCategories, products]);

  // UI state
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [activeTabId, setActiveTabId] = useState("");

  // Modals
  const [optionsProduct, setOptionsProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Build grouped sections with interleaved promo banners
  const groupedSections = useMemo(() => {
    // Apply search + sort to all products
    let filtered = [...products];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "price-asc":
        filtered.sort((a, b) => getProductPrice(a) - getProductPrice(b));
        break;
      case "price-desc":
        filtered.sort((a, b) => getProductPrice(b) - getProductPrice(a));
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Group by category
    const byCategory = new Map<string, Product[]>();
    for (const p of filtered) {
      if (!byCategory.has(p.categoryId)) byCategory.set(p.categoryId, []);
      byCategory.get(p.categoryId)!.push(p);
    }

    // Only categories with products
    const catsWithProducts = visibleCategories.filter((cat) => byCategory.has(cat.id));

    // Separate promo types
    const allScopePromos = activePromotions.filter((p) => p.applyScope === "all");
    const categoryScopePromos = activePromotions.filter((p) => p.applyScope === "categories");
    const shownPromoIds = new Set<string>();

    const sections: Section[] = [];

    catsWithProducts.forEach((cat, index) => {
      // "all" scope promos: insert between 1st and 2nd category
      if (index === 1) {
        for (const promo of allScopePromos) {
          if (!shownPromoIds.has(promo.id)) {
            sections.push({ type: "promo", promotion: promo });
            shownPromoIds.add(promo.id);
          }
        }
      }

      // Category-specific promos: insert before their target category
      for (const promo of categoryScopePromos) {
        if (promo.categoryIds.includes(cat.id) && !shownPromoIds.has(promo.id)) {
          sections.push({ type: "promo", promotion: promo });
          shownPromoIds.add(promo.id);
        }
      }

      sections.push({ type: "category", category: cat, products: byCategory.get(cat.id)! });
    });

    // Edge case: only 1 category — still show "all" promos before it
    if (catsWithProducts.length <= 1) {
      for (const promo of allScopePromos) {
        if (!shownPromoIds.has(promo.id)) {
          sections.unshift({ type: "promo", promotion: promo });
        }
      }
    }

    return sections;
  }, [products, visibleCategories, activePromotions, search, sort]);

  // Categories currently in view (for tabs)
  const tabCategories = useMemo(
    () => groupedSections.filter((s): s is Section & { type: "category" } => s.type === "category").map((s) => s.category),
    [groupedSections]
  );

  // Set initial active tab
  useEffect(() => {
    if (tabCategories.length > 0 && !activeTabId) {
      setActiveTabId(tabCategories[0].id);
    }
  }, [tabCategories, activeTabId]);

  // Scroll-spy with IntersectionObserver
  const sectionRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const timer = setTimeout(() => {
      for (const cat of tabCategories) {
        const el = sectionRefs.current.get(cat.id);
        if (!el) continue;

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveTabId(cat.id);
            }
          },
          { rootMargin: "-160px 0px -60% 0px", threshold: 0 }
        );
        observer.observe(el);
        observers.push(observer);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      observers.forEach((obs) => obs.disconnect());
    };
  }, [tabCategories]);

  // Tab click → smooth scroll
  const handleTabClick = useCallback((categoryId: string) => {
    const el = document.getElementById(`cat-${categoryId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

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

  const hasCategorySections = groupedSections.some((s) => s.type === "category");

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

        {/* Sticky Category Tabs */}
        {tabCategories.length > 0 && (
          <CategoryTabs
            categories={tabCategories}
            activeId={activeTabId}
            onSelect={handleTabClick}
          />
        )}

        {/* Search and sort */}
        <section className="mt-4">
          <SearchAndSort
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
        </section>

        {/* Interleaved category sections + promo banners */}
        {!hasCategorySections ? (
          <div className="text-center py-12 opacity-50">
            No se encontraron productos
          </div>
        ) : (
          groupedSections.map((section) => {
            if (section.type === "promo") {
              return <PromoBanner key={`promo-${section.promotion.id}`} promotion={section.promotion} />;
            }
            return (
              <section
                key={section.category.id}
                id={`cat-${section.category.id}`}
                ref={(el) => { sectionRefs.current.set(section.category.id, el); }}
                className="mt-10 scroll-mt-40"
              >
                <h2 className="text-2xl font-bold mb-5 flex items-center gap-2" style={{ color: "var(--title-text)" }}>
                  {section.category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOptions={handleOpenOptions}
                      onAdd={handleAddSimple}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
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
