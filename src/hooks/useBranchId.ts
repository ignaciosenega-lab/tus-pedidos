import { useState, useEffect } from "react";
import { useAuth } from "../store/authContext";
import { useApi } from "./useApi";

interface Branch {
  id: number;
  slug: string;
  name: string;
}

export function useBranchId() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(
    user?.branch_id ?? null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.role !== "master") {
      setSelectedBranchId(user.branch_id ?? null);
      setLoading(false);
      return;
    }
    // Master: fetch all branches, pick the first
    apiFetch<Branch[]>("/api/branches")
      .then((data) => {
        setBranches(data);
        if (data.length > 0 && !selectedBranchId) {
          setSelectedBranchId(data[0].id);
        }
      })
      .catch((err) => {
        setError(err.message || "Error al cargar sucursales");
      })
      .finally(() => setLoading(false));
  }, [user?.role, user?.branch_id]);

  return {
    branchId: selectedBranchId,
    setBranchId: setSelectedBranchId,
    branches,
    isMaster: user?.role === "master",
    loading,
    error,
  };
}
