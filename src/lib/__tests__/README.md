# Tests Unitaires - Guide d'implémentation

## Vue d'ensemble

Les tests unitaires pour les systèmes critiques nécessitent une configuration spécifique car certains systèmes dépendent du bridge QGIS.

## Approche recommandée

### 1. Systèmes testables sans QGIS (JavaScript pur)

Ces systèmes peuvent être testés directement :

- **Data Parcel Matcher** (`data-parcel-matcher.ts`)
  - Algorithmes Levenshtein
  - Fuzzy matching
  - Scoring multicritères

- **Cache Manager** (`cache-manager.ts`)
  - Opérations localStorage
  - TTL expiration
  - LRU eviction

### 2. Systèmes nécessitant des mocks QGIS

Ces systèmes nécessitent des mocks du bridge QGIS :

- FileManager
- Session Manager
- Parcel Identification Service
- Selective Parcel Extractor
- Geoprocessing Manager
- Symbology Applier
- Forest Document Retriever
- Geospatial Validator
- Export Print Manager
- Multi-Format Export Manager

## Configuration de test recommandée

### Installation des dépendances

```bash
npm install --save-dev vitest @vitest/ui
```

### Configuration vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/lib/__tests__/setup.ts"]
  }
});
```

### Fichier setup.ts pour mocks

```typescript
// src/lib/__tests__/setup.ts
import { vi } from "vitest";

// Mock du bridge QGIS
vi.mock("../qgis", () => ({
  runScriptDetailed: vi.fn().mockResolvedValue({
    ok: true,
    message: "success"
  }),
  pickQgisFile: vi.fn().mockResolvedValue("/mock/path/file.txt"),
  isQgisAvailable: vi.fn().mockReturnValue(true)
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => store[key] = value,
    removeItem: (key: string) => delete store[key],
    clear: () => store = {}
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock
});
```

## Exemple de test pour Data Parcel Matcher

```typescript
// src/lib/__tests__/data-parcel-matcher.test.ts
import { describe, it, expect } from "vitest";
import { DataParcelMatcher } from "../data-parcel-matcher";

describe("Data Parcel Matcher", () => {
  const matcher = new Data ParcelMatcher();

  it("should calculate Levenshtein distance correctly", () => {
    expect(matcher["levenshteinDistance"]("kitten", "sitting")).toBe(3);
  });

  it("should match similar strings", () => {
    expect(matcher["fuzzyMatch"]("test", "test", 0.8)).toBe(true);
  });
});
```

## Exemple de test avec mock QGIS

```typescript
// src/lib/__tests__/file-manager.test.ts
import { describe, it, expect, vi } from "vitest";
import { FileManager } from "../file-manager";
import { runScriptDetailed } from "../qgis";

vi.mock("../qgis");

describe("FileManager", () => {
  it("should read file successfully", async () => {
    vi.mocked(runScriptDetailed).mockResolvedValue({
      ok: true,
      message: "file content"
    });

    const manager = new FileManager();
    const content = await manager.readFile("/test/file.txt");
    expect(content).toBe("file content");
  });
});
```

## Exécution des tests

```bash
# Exécuter tous les tests
npm run test

# Exécuter en mode watch
npm run test:watch

# Exécuter avec UI
npm run test:ui

# Couverture de code
npm run test:coverage
```

## Scripts package.json recommandés

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Priorité des tests

1. **Haute priorité** (algorithmes JS purs)
   - Data Parcel Matcher
   - Cache Manager

2. **Moyenne priorité** (avec mocks QGIS)
   - FileManager
   - Session Manager
   - Parcel Identification Service

3. **Basse priorité** (intégration complète)
   - Geoprocessing Manager
   - Symbology Applier
   - Export Managers

## Notes

- Les tests nécessitant le bridge QGIS doivent utiliser des mocks
- localStorage peut être mocké pour les tests
- Les tests async doivent utiliser `async/await`
- Utiliser `vi.fn()` pour créer des mocks Vitest
