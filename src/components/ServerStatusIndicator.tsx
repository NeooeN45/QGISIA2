import { memo, useCallback, useState } from "react";
import { useServerHealth } from "@/src/hooks/useServerHealth";

interface ServerStatusIndicatorProps {
  showUrl?: boolean;
  compact?: boolean;
}

export const ServerStatusIndicator = memo(function ServerStatusIndicator({
  showUrl = false,
  compact = true,
}: ServerStatusIndicatorProps) {
  const { serverInfo, isConnected, error } = useServerHealth();
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = useCallback(() => {
    if (serverInfo?.url) {
      navigator.clipboard.writeText(serverInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [serverInfo?.url]);

  if (compact && !showUrl) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface2 border border-border">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-accent" : "bg-danger"
          }`}
          title={isConnected ? "Bridge connecté" : "Bridge déconnecté"}
        />
        <span className="text-xs text-muted">
          {isConnected ? (
            <>Port {serverInfo?.port}</>
          ) : (
            <>Erreur: {error?.slice(0, 15)}</>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded bg-surface2 border border-border">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-accent animate-pulse" : "bg-danger"
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? "Bridge connecté" : "Bridge déconnecté"}
          </span>
        </div>
      </div>

      {isConnected && serverInfo && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Port:</span>
            <code className="bg-surface px-2 py-1 rounded font-mono">
              {serverInfo.port}
            </code>
          </div>

          {showUrl && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">URL:</span>
              <button
                onClick={handleCopyUrl}
                className="flex-1 text-right px-2 py-1 rounded bg-surface hover:bg-border transition-colors font-mono text-accent hover:text-accent/80"
                title="Copier l'URL"
              >
                {copied ? "✓ Copié" : serverInfo.url}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-muted">
            <span>Statut:</span>
            <span className="text-accent">{serverInfo.bridge_status}</span>
          </div>
        </div>
      )}

      {!isConnected && error && (
        <div className="text-xs text-danger p-2 rounded bg-danger/10">
          {error}
        </div>
      )}
    </div>
  );
});

export default ServerStatusIndicator;
