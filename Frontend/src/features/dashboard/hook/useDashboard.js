import { useCallback, useEffect, useState } from "react";
import { getDashboardData } from "../api/dashboard.api";

const useDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getDashboardData();

      if (!response?.success || !response?.data) {
        throw new Error(
          response?.message || "Unable to load dashboard."
        );
      }

      setData(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        error.message ||
        "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboard,
  };
};

export default useDashboard;