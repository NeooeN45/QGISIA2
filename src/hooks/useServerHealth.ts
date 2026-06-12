import { useEffect, useState } from "react";

export interface ServerInfo {
  port: number;
  url: string;
  bridge_status: "connected" | "disconnected" | "error";
  timestamp: number;
}

export function useServerHealth() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchServerInfo = async () => {
      try {
        const response = await fetch("/api/qgis/serverInfo", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (mounted) {
          setServerInfo(data);
          setIsConnected(true);
          setError(null);
          setLastFetch(Date.now());
        }
      } catch (err) {
        if (mounted) {
          setIsConnected(false);
          setError(err instanceof Error ? err.message : "Connection failed");
        }
      }
    };

    // Fetch immediately
    fetchServerInfo();

    // Poll every 30 seconds
    interval = setInterval(fetchServerInfo, 30000);

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  return {
    serverInfo,
    isConnected,
    error,
    lastFetch,
    port: serverInfo?.port,
    url: serverInfo?.url,
  };
}
