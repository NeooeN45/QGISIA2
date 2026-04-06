/**
 * Project and Workspace Management
 * 
 * Système de gestion de projets et d'espaces de travail
 * Gère les projets QGIS et les espaces de travail collaboratifs
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  lastModified: number;
  author: string;
  layers: string[];
  layouts: string[];
  settings: ProjectSettings;
  tags: string[];
  isShared: boolean;
}

export interface ProjectSettings {
  crs: string;
  extent: { xmin: number; ymin: number; xmax: number; ymax: number };
  scale: number;
  theme: "light" | "dark";
  autoSave: boolean;
  autoSaveInterval: number;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  projects: string[];
  members: WorkspaceMember[];
  permissions: WorkspacePermissions;
  createdAt: number;
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: number;
}

export interface WorkspacePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canInvite: boolean;
}

/**
 * Gestionnaire de projets et espaces de travail
 */
export class ProjectManager {
  private projects: Map<string, Project>;
  private workspaces: Map<string, Workspace>;
  
  constructor() {
    this.projects = new Map();
    this.workspaces = new Map();
    this.loadFromStorage();
  }
  
  /**
   * Crée un nouveau projet
   */
  createProject(
    name: string,
    description: string,
    author: string,
    settings: Partial<ProjectSettings> = {}
  ): Project {
    console.log(`📁 Création de projet: ${name}`);
    
    const project: Project = {
      id: `project_${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      lastModified: Date.now(),
      author,
      layers: [],
      layouts: [],
      settings: {
        crs: "EPSG:2154",
        extent: { xmin: 0, ymin: 0, xmax: 10000, ymax: 10000 },
        scale: 10000,
        theme: "dark",
        autoSave: true,
        autoSaveInterval: 60000,
        ...settings,
      },
      tags: [],
      isShared: false,
    };
    
    this.projects.set(project.id, project);
    this.saveToStorage();
    
    console.log(`   ✅ Projet créé: ${project.id}`);
    return project;
  }
  
  /**
   * Charge un projet existant
   */
  loadProject(projectId: string): Project | null {
    console.log(`📂 Chargement de projet: ${projectId}`);
    
    const project = this.projects.get(projectId);
    if (!project) {
      console.log(`   ❌ Projet non trouvé`);
      return null;
    }
    
    // Restaurer l'état du projet
    this.restoreProjectState(project);
    
    console.log(`   ✅ Projet chargé`);
    return project;
  }
  
  /**
   * Sauvegarde l'état actuel du projet
   */
  saveProject(projectId: string): boolean {
    console.log(`💾 Sauvegarde de projet: ${projectId}`);
    
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    // Capturer l'état actuel
    const currentState = this.captureProjectState();
    
    project.layers = currentState.layers;
    project.layouts = currentState.layouts;
    project.lastModified = Date.now();
    
    this.projects.set(projectId, project);
    this.saveToStorage();
    
    console.log(`   ✅ Projet sauvegardé`);
    return true;
  }
  
  /**
   * Supprime un projet
   */
  deleteProject(projectId: string): boolean {
    console.log(`🗑️  Suppression de projet: ${projectId}`);
    
    const deleted = this.projects.delete(projectId);
    
    if (deleted) {
      this.saveToStorage();
      console.log(`   ✅ Projet supprimé`);
    }
    
    return deleted;
  }
  
  /**
   * Clone un projet
   */
  cloneProject(projectId: string, newName: string): Project | null {
    console.log(`📋 Clonage de projet: ${projectId}`);
    
    const project = this.projects.get(projectId);
    if (!project) {
      return null;
    }
    
    const cloned: Project = {
      ...project,
      id: `project_${Date.now()}`,
      name: newName,
      description: `${project.description} (copie)`,
      createdAt: Date.now(),
      lastModified: Date.now(),
      isShared: false,
    };
    
    this.projects.set(cloned.id, cloned);
    this.saveToStorage();
    
    console.log(`   ✅ Projet cloné: ${cloned.id}`);
    return cloned;
  }
  
  /**
   * Liste tous les projets
   */
  listProjects(): Project[] {
    return Array.from(this.projects.values()).sort((a, b) => b.lastModified - a.lastModified);
  }
  
  /**
   * Recherche des projets
   */
  searchProjects(query: string): Project[] {
    const lowerQuery = query.toLowerCase();
    
    return this.listProjects().filter(project =>
      project.name.toLowerCase().includes(lowerQuery) ||
      project.description.toLowerCase().includes(lowerQuery) ||
      project.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * Ajoute un tag à un projet
   */
  addProjectTag(projectId: string, tag: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    if (!project.tags.includes(tag)) {
      project.tags.push(tag);
      project.lastModified = Date.now();
      this.projects.set(projectId, project);
      this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Supprime un tag d'un projet
   */
  removeProjectTag(projectId: string, tag: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    const index = project.tags.indexOf(tag);
    if (index >= 0) {
      project.tags.splice(index, 1);
      project.lastModified = Date.now();
      this.projects.set(projectId, project);
      this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Crée un espace de travail
   */
  createWorkspace(
    name: string,
    description: string,
    owner: WorkspaceMember
  ): Workspace {
    console.log(`🏢 Création d'espace de travail: ${name}`);
    
    const workspace: Workspace = {
      id: `workspace_${Date.now()}`,
      name,
      description,
      projects: [],
      members: [owner],
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canInvite: true,
      },
      createdAt: Date.now(),
    };
    
    this.workspaces.set(workspace.id, workspace);
    this.saveToStorage();
    
    console.log(`   ✅ Espace de travail créé: ${workspace.id}`);
    return workspace;
  }
  
  /**
   * Ajoute un membre à un espace de travail
   */
  addWorkspaceMember(
    workspaceId: string,
    member: WorkspaceMember
  ): boolean {
    console.log(`👤 Ajout de membre: ${workspaceId}`);
    
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }
    
    workspace.members.push(member);
    this.workspaces.set(workspaceId, workspace);
    this.saveToStorage();
    
    console.log(`   ✅ Membre ajouté`);
    return true;
  }
  
  /**
   * Supprime un membre d'un espace de travail
   */
  removeWorkspaceMember(workspaceId: string, userId: string): boolean {
    console.log(`👤 Suppression de membre: ${workspaceId}`);
    
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }
    
    const index = workspace.members.findIndex(m => m.userId === userId);
    if (index >= 0) {
      workspace.members.splice(index, 1);
      this.workspaces.set(workspaceId, workspace);
      this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Ajoute un projet à un espace de travail
   */
  addProjectToWorkspace(workspaceId: string, projectId: string): boolean {
    console.log(`📁 Ajout de projet: ${workspaceId}`);
    
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }
    
    if (!workspace.projects.includes(projectId)) {
      workspace.projects.push(projectId);
      this.workspaces.set(workspaceId, workspace);
      this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Supprime un projet d'un espace de travail
   */
  removeProjectFromWorkspace(workspaceId: string, projectId: string): boolean {
    console.log(`📁 Suppression de projet: ${workspaceId}`);
    
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }
    
    const index = workspace.projects.indexOf(projectId);
    if (index >= 0) {
      workspace.projects.splice(index, 1);
      this.workspaces.set(workspaceId, workspace);
      this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Liste tous les espaces de travail
   */
  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }
  
  /**
   * Exporte un projet
   */
  exportProject(projectId: string): string | null {
    const project = this.projects.get(projectId);
    if (!project) {
      return null;
    }
    
    return JSON.stringify(project, null, 2);
  }
  
  /**
   * Importe un projet
   */
  importProject(jsonData: string): Project | null {
    try {
      const project = JSON.parse(jsonData) as Project;
      
      // Générer un nouvel ID
      project.id = `project_${Date.now()}`;
      project.createdAt = Date.now();
      project.lastModified = Date.now();
      
      this.projects.set(project.id, project);
      this.saveToStorage();
      
      console.log(`   ✅ Projet importé`);
      return project;
    } catch (error) {
      console.log(`   ❌ Erreur d'import: ${error}`);
      return null;
    }
  }
  
  /**
   * Capture l'état actuel du projet
   */
  private captureProjectState(): { layers: string[]; layouts: string[] } {
    // À implémenter avec le bridge QGIS
    return {
      layers: [],
      layouts: [],
    };
  }
  
  /**
   * Restaure l'état du projet
   */
  private restoreProjectState(project: Project): void {
    // À implémenter avec le bridge QGIS
    console.log(`   🔄 Restauration de l'état: ${project.layers.length} couches`);
  }
  
  /**
   * Sauvegarde dans localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        projects: Array.from(this.projects.values()),
        workspaces: Array.from(this.workspaces.values()),
      };
      localStorage.setItem("qgis_projects", JSON.stringify(data));
    } catch (error) {
      console.log(`   ⚠️  Erreur de sauvegarde: ${error}`);
    }
  }
  
  /**
   * Charge depuis localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem("qgis_projects");
      if (data) {
        const parsed = JSON.parse(data);
        for (const project of parsed.projects || []) {
          this.projects.set(project.id, project);
        }
        for (const workspace of parsed.workspaces || []) {
          this.workspaces.set(workspace.id, workspace);
        }
        console.log(`   💾 ${this.projects.size} projet(s), ${this.workspaces.size} espace(s) de travail chargé(s)`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur de chargement: ${error}`);
    }
  }
}

/**
 * Helper pour créer un gestionnaire de projets
 */
export function createProjectManager(): ProjectManager {
  return new ProjectManager();
}
