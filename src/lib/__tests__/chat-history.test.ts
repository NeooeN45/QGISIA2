import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMessage,
  createConversation,
  buildConversationTitle,
  finalizeConversation,
  sortConversations,
  loadConversationHistory,
  saveConversationHistory,
} from "../chat-history";

// ── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// ── Tests ────────────────────────────────────────────────────────────────────
describe("createMessage", () => {
  it("crée un message avec role et contenu", () => {
    const msg = createMessage("user", "  Bonjour  ");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Bonjour");
    expect(msg.id).toMatch(/^message-/);
    expect(msg.createdAt).toBeTruthy();
  });

  it("trim le contenu", () => {
    expect(createMessage("assistant", "  hello  ").content).toBe("hello");
  });
});

describe("buildConversationTitle", () => {
  it("retourne le fallback si aucun message utilisateur", () => {
    const msg = createMessage("assistant", "Je suis prêt.");
    expect(buildConversationTitle([msg])).toBe("Nouvelle discussion");
  });

  it("truncate à 52 caractères avec '...'", () => {
    const long = "A".repeat(60);
    const msg = createMessage("user", long);
    const title = buildConversationTitle([msg]);
    expect(title.length).toBeLessThanOrEqual(52);
    expect(title.endsWith("...")).toBe(true);
  });

  it("retourne le texte court tel quel", () => {
    const msg = createMessage("user", "Analyse mes couches");
    expect(buildConversationTitle([msg])).toBe("Analyse mes couches");
  });
});

describe("createConversation", () => {
  it("crée une conversation avec le message initial", () => {
    const msg = createMessage("assistant", "Bonjour");
    const conv = createConversation(msg);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].id).toBe(msg.id);
    expect(conv.selectedLayerIds).toEqual([]);
    expect(conv.mode).toBe("chat");
  });
});

describe("finalizeConversation", () => {
  it("met à jour le titre et updatedAt par défaut", () => {
    const msg = createMessage("user", "Test finalisation");
    const conv = createConversation(msg);
    const before = conv.updatedAt;
    const finalized = finalizeConversation(conv);
    expect(finalized.title).toBe("Test finalisation");
    expect(finalized.updatedAt >= before).toBe(true);
  });

  it("ne met pas à jour updatedAt si touch=false", () => {
    const msg = createMessage("user", "Ne pas toucher");
    const conv = createConversation(msg);
    const finalized = finalizeConversation(conv, { touch: false });
    expect(finalized.updatedAt).toBe(conv.updatedAt);
  });
});

describe("sortConversations", () => {
  it("trie par updatedAt décroissant", () => {
    const old = { ...createConversation(createMessage("user", "Ancien")), updatedAt: "2024-01-01T00:00:00.000Z" };
    const recent = { ...createConversation(createMessage("user", "Récent")), updatedAt: "2025-01-01T00:00:00.000Z" };
    const sorted = sortConversations([old, recent]);
    expect(sorted[0].updatedAt).toBe(recent.updatedAt);
  });
});

describe("saveConversationHistory / loadConversationHistory", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => localStorageMock.clear());

  it("round-trip persist/restore", () => {
    const msg = createMessage("user", "Persistance");
    const conv = createConversation(msg);
    saveConversationHistory([conv], conv.id);
    const loaded = loadConversationHistory();
    expect(loaded.conversations).toHaveLength(1);
    expect(loaded.conversations[0].id).toBe(conv.id);
    expect(loaded.activeConversationId).toBe(conv.id);
  });

  it("retourne une liste vide si localStorage vide", () => {
    const loaded = loadConversationHistory();
    expect(loaded.conversations).toHaveLength(0);
    expect(loaded.activeConversationId).toBeNull();
  });

  it("ignore un JSON corrompu sans crash", () => {
    localStorageMock.setItem("geoai-chat-history", "{ invalid json {{");
    expect(() => loadConversationHistory()).not.toThrow();
    const loaded = loadConversationHistory();
    expect(loaded.conversations).toHaveLength(0);
  });
});
