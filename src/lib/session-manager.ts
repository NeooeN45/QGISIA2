import { runScriptDetailed, isQgisAvailable } from "./qgis";

export interface SessionState {
  sessionId: string;
  name: string;
  description: string;
  createdAt: number;
  lastModified: number;
  layers: LayerState[];
  layouts: LayoutState[];
  settings: SessionSettings;
  metadata: SessionMetadata;
}

export interface LayerState {
  id: string;
  name: string;
  source: string;
  visible: boolean;
  opacity: number;
  style?: any;
  fields: string[];
}

export interface LayoutState {
  id: string;
  name: string;
  elements: any[];
  pageSize: string;
  orientation: string;
}

export interface SessionSettings {
  crs: string;
  extent: { xmin: number; ymin: number; xmax: number; ymax: number };
  scale: number;
  theme: "light" | "dark";
}

export interface SessionMetadata {
  version: string;
  tags: string[];
  author: string;
  isAutoSave: boolean;
}

export interface SessionSnapshot {
  sessionId: string;
  timestamp: number;
  state: Partial<SessionState>;
  description: string;
}

/**
 * Gestionnaire de sessions
 */
export class SessionManager {
  private sessions: Map<string, SessionState>;
  private snapshots: Map<string, SessionSnapshot[]>;
  private currentSessionId: string | null;
  private autoSaveInterval: number | null;
  
  constructor() {
    this.sessions = new Map();
    this.snapshots = new Map();
    this.currentSessionId = null;
    this.autoSaveInterval = null;
    
    // Charger les sessions sauvegardées
    this.loadSessions();
  }
  
  /**
   * Crée une nouvelle session
   */
  createSession(
    name: string,
    description: string,
    metadata: Partial<SessionMetadata> = {}
  ): SessionState {
    console.log(`📝 Création de session: ${name}`);
    
    const sessionId = `session_${Date.now()}`;
    
    const session: SessionState = {
      sessionId,
      name,
      description,
      createdAt: Date.now(),
      lastModified: Date.now(),
      layers: [],
      layouts: [],
      settings: {
        crs: "EPSG:2154",
        extent: { xmin: 0, ymin: 0, xmax: 10000, ymax: 10000 },
        scale: 10000,
        theme: "dark",
      },
      metadata: {
        version: "1.0",
        tags: [],
        author: "user",
        isAutoSave: false,
        ...metadata,
      },
    };
    
    this.sessions.set(sessionId, session);
    this.snapshots.set(sessionId, []);
    this.currentSessionId = sessionId;
    
    this.saveSessions();
    
    console.log(`   ✅ Session créée: ${sessionId}`);
    return session;
  }
  
  /**
   * Charge une session existante
   */
  async loadSession(sessionId: string): Promise<SessionState | null> {
    console.log(`📂 Chargement de session: ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`   ❌ Session non trouvée`);
      return null;
    }
    
    this.currentSessionId = sessionId;
    
    // Restaurer l'état
    await this.restoreSessionState(session);
    
    console.log(`   ✅ Session chargée`);
    return session;
  }
  
  /**
   * Sauvegarde l'état actuel de la session
   */
  saveSession(): boolean {
    if (!this.currentSessionId) {
      console.log(`   ⚠️  Aucune session active`);
      return false;
    }
    
    console.log(`💾 Sauvegarde de session: ${this.currentSessionId}`);
    
    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      return false;
    }
    
    // Capturer l'état actuel
    const currentState = this.captureSessionState();
    
    // Mettre à jour la session
    session.layers = currentState.layers;
    session.layouts = currentState.layouts;
    session.settings = currentState.settings;
    session.lastModified = Date.now();
    
    this.sessions.set(this.currentSessionId, session);
    this.saveSessions();
    
    console.log(`   ✅ Session sauvegardée`);
    return true;
  }
  
  /**
   * Supprime une session
   */
  deleteSession(sessionId: string): boolean {
    console.log(`🗑️  Suppression de session: ${sessionId}`);
    
    const deleted = this.sessions.delete(sessionId);
    this.snapshots.delete(sessionId);
    
    if (deleted) {
      this.saveSessions();
      console.log(`   ✅ Session supprimée`);
    }
    
    return deleted;
  }
  
  /**
   * Crée un snapshot de la session actuelle
   */
  createSnapshot(description: string): SessionSnapshot | null {
    if (!this.currentSessionId) {
      console.log(`   ⚠️  Aucune session active`);
      return null;
    }
    
    console.log(`📸 Création de snapshot: ${description}`);
    
    const snapshot: SessionSnapshot = {
      sessionId: this.currentSessionId,
      timestamp: Date.now(),
      state: this.captureSessionState(),
      description,
    };
    
    const snapshots = this.snapshots.get(this.currentSessionId) || [];
    snapshots.push(snapshot);
    this.snapshots.set(this.currentSessionId, snapshots);
    
    // Garder seulement les 10 derniers snapshots
    if (snapshots.length > 10) {
      snapshots.shift();
    }
    
    this.saveSessions();
    
    console.log(`   ✅ Snapshot créé`);
    return snapshot;
  }
  
  /**
   * Restaure un snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    console.log(`🔄 Restauration de snapshot: ${snapshotId}`);
    
    if (!this.currentSessionId) {
      console.log(`   ⚠️  Aucune session active`);
      return false;
    }
    
    const snapshots = this.snapshots.get(this.currentSessionId) || [];
    const snapshot = snapshots.find(s => s.sessionId + s.timestamp.toString() === snapshotId);
    
    if (!snapshot) {
      console.log(`   ❌ Snapshot non trouvé`);
      return false;
    }
    
    await this.restoreSessionState(snapshot.state as SessionState);
    
    console.log(`   ✅ Snapshot restauré`);
    return true;
  }
  
  /**
   * Liste toutes les sessions
   */
  listSessions(): SessionState[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastModified - a.lastModified);
  }
  
  /**
   * Retourne la session actuelle
   */
  getCurrentSession(): SessionState | null {
    if (!this.currentSessionId) {
      return null;
    }
    return this.sessions.get(this.currentSessionId) || null;
  }
  
  /**
   * Active la sauvegarde automatique
   */
  enableAutoSave(interval: number = 60000): void {
    console.log(`⏰ Auto-save activé: ${interval}ms`);
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = window.setInterval(() => {
      this.saveSession();
    }, interval);
  }
  
  /**
   * Désactive la sauvegarde automatique
   */
  disableAutoSave(): void {
    console.log(`⏰ Auto-save désactivé`);
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  /**
   * Exporte une session
   */
  exportSession(sessionId: string): string | null {
    console.log(`📤 Export de session: ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    const exportData = JSON.stringify(session, null, 2);
    
    console.log(`   ✅ Session exportée`);
    return exportData;
  }
  
  /**
   * Importe une session
   */
  importSession(jsonData: string): SessionState | null {
    console.log(`📥 Import de session`);
    
    try {
      const session = JSON.parse(jsonData) as SessionState;
      
      // Générer un nouvel ID pour éviter les conflits
      session.sessionId = `session_${Date.now()}`;
      session.createdAt = Date.now();
      session.lastModified = Date.now();
      
      this.sessions.set(session.sessionId, session);
      this.snapshots.set(session.sessionId, []);
      this.saveSessions();
      
      console.log(`   ✅ Session importée`);
      return session;
    } catch (error) {
      console.log(`   ❌ Erreur d'import: ${error}`);
      return null;
    }
  }
  
  /**
   * Capture l'état actuel de la session
   */
  private captureSessionState(): Partial<SessionState> {
    // À implémenter avec le bridge QGIS pour capturer l'état réel
    return {
      layers: [],
      layouts: [],
      settings: {
        crs: "EPSG:2154",
        extent: { xmin: 0, ymin: 0, xmax: 10000, ymax: 10000 },
        scale: 10000,
        theme: "dark",
      },
    };
  }
  
  /**
   * Restaure l'état d'une session via QGIS
   */
  private async restoreSessionState(state: SessionState): Promise<void> {
    if (!isQgisAvailable()) {
      console.log(`   ⚠️  Bridge QGIS non disponible, restauration limitée`);
      return;
    }
    
    console.log(`   🔄 Restauration de l'état: ${state.layers.length} couches`);
    
    try {
      // Restaurer le CRS
      if (state.settings.crs) {
        const crsScript = `
from qgis.core import QgsProject
project = QgsProject.instance()
project.setCrs(QgsCoordinateReferenceSystem("${state.settings.crs}"))
print("success:CRS restauré")
`;
        await runScriptDetailed(crsScript);
      }
      
      // Restaurer les couches (visibilité, opacité)
      for (const layerState of state.layers) {
        const layerScript = `
from qgis.core import QgsProject
project = QgsProject.instance()
layer = project.mapLayer("${layerState.id}")
if layer:
    layer.setItemVisibilityChecked(${layerState.visible})
    layer.setOpacity(${layerState.opacity})
    print(f"success:Couche ${layerState.id} restaurée")
else:
    print(f"warning:Couche ${layerState.id} non trouvée")
`;
        await runScriptDetailed(layerScript);
      }
      
      console.log(`   ✅ État restauré avec succès`);
      
    } catch (error) {
      console.error(`   ❌ Erreur de restauration:`, error);
    }
  }
  
  /**
   * Sauvegarde les sessions dans localStorage
   */
  private saveSessions(): void {
    try {
      const sessionsData = Array.from(this.sessions.values());
      localStorage.setItem("qgis_sessions", JSON.stringify(sessionsData));
      console.log(`   💾 Sessions sauvegardées dans localStorage`);
    } catch (error) {
      console.log(`   ⚠️  Erreur de sauvegarde: ${error}`);
    }
  }
  
  /**
   * Charge les sessions depuis localStorage
   */
  private loadSessions(): void {
    try {
      const data = localStorage.getItem("qgis_sessions");
      if (data) {
        const sessions = JSON.parse(data) as SessionState[];
        for (const session of sessions) {
          this.sessions.set(session.sessionId, session);
          this.snapshots.set(session.sessionId, []);
        }
        console.log(`   💾 ${sessions.length} session(s) chargée(s)`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur de chargement: ${error}`);
    }
  }
  
  /**
   * Renomme une session
   */
  renameSession(sessionId: string, newName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    session.name = newName;
    session.lastModified = Date.now();
    this.sessions.set(sessionId, session);
    this.saveSessions();
    
    return true;
  }
  
  /**
   * Ajoute un tag à une session
   */
  addTag(sessionId: string, tag: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    if (!session.metadata.tags.includes(tag)) {
      session.metadata.tags.push(tag);
      session.lastModified = Date.now();
      this.sessions.set(sessionId, session);
      this.saveSessions();
    }
    
    return true;
  }
  
  /**
   * Recherche des sessions par tag
   */
  findByTag(tag: string): SessionState[] {
    return Array.from(this.sessions.values()).filter(
      session => session.metadata.tags.includes(tag)
    );
  }
}

/**
 * Helper pour créer un gestionnaire de sessions
 */
export function createSessionManager(): SessionManager {
  return new SessionManager();
}
