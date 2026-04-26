import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkServiceHealth } from "../service-health";
import type { CatalogItem } from "../catalog";

const baseItem: CatalogItem = {
  id: "test",
  name: "Test Service",
  serviceType: "WMS",
  url: "https://example.com/wms",
  provider: "Test",
  description: "",
};

describe("checkServiceHealth", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should_return_ok_when_fetch_succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null));
    const result = await checkServiceHealth(baseItem);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("ok");
  });

  it("should_block_when_requiresKey_and_no_apiKey", async () => {
    const item = { ...baseItem, requiresKey: true, provider: "Mapbox" };
    const result = await checkServiceHealth(item);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("requires-key");
    expect(result.message).toContain("Mapbox");
  });

  it("should_pass_when_requiresKey_with_apiKey", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null));
    const item = { ...baseItem, requiresKey: true };
    const result = await checkServiceHealth(item, { apiKey: "abc123" });
    expect(result.ok).toBe(true);
  });

  it("should_return_invalid_url_when_url_malformed", async () => {
    const item = { ...baseItem, url: "not a url" };
    const result = await checkServiceHealth(item);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid-url");
  });

  it("should_return_network_when_fetch_throws_typeerror", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await checkServiceHealth(baseItem);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("network");
    expect(result.message).toContain("injoignable");
  });

  it("should_return_timeout_when_aborted", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const err = new DOMException("aborted", "AbortError");
      return Promise.reject(err);
    });
    const result = await checkServiceHealth(baseItem, { timeoutMs: 100 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timeout");
  });

  it("should_build_GetCapabilities_url_for_WMS", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    globalThis.fetch = fetchSpy;
    await checkServiceHealth(baseItem);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("SERVICE=WMS");
    expect(calledUrl).toContain("REQUEST=GetCapabilities");
  });

  it("should_substitute_xyz_template_placeholders", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    globalThis.fetch = fetchSpy;
    const item: CatalogItem = {
      ...baseItem,
      serviceType: "XYZ",
      url: "https://tile.example.com/{z}/{x}/{y}.png",
    };
    await checkServiceHealth(item);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://tile.example.com/0/0/0.png");
  });

  it("should_use_f_json_for_arcgis", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    globalThis.fetch = fetchSpy;
    const item: CatalogItem = {
      ...baseItem,
      serviceType: "ArcGISMapServer",
      url: "https://server.arcgis.com/rest/services/Foo/MapServer",
    };
    await checkServiceHealth(item);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("f=json");
  });
});
