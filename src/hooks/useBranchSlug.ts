import { useMemo } from "react";
import { useLocation } from "react-router-dom";

/**
 * Extract branch slug from URL pattern /s/:slug
 * Returns null if not on a branch-specific route
 */
export function useBranchSlug(): string | null {
  const location = useLocation();

  return useMemo(() => {
    const match = location.pathname.match(/^\/s\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);
}
