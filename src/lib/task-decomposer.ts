/**
 * Task Decomposition Engine
 * 
 * Moteur de décomposition des demandes complexes en sous-tâches
 * Analyse les demandes utilisateur et génère des plans d'exécution structurés
 */

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  dependencies: string[];
  estimatedDuration: number; // en minutes
  requiredTools: string[];
  outputArtifacts: string[];
  parameters: Record<string, any>;
  priority: "high" | "medium" | "low";
  retryCount: number;
  maxRetries: number;
}

export type TaskType =
  | "data_acquisition"
  | "data_processing"
  | "symbology"
  | "layout"
  | "export"
  | "validation"
  | "geoprocessing"
  | "spatial_analysis"
  | "attribute_management"
  | "file_operation";

export interface ExecutionPlan {
  id: string;
  userRequest: string;
  tasks: Task[];
  estimatedTotalDuration: number;
  requiredStandards: string[];
  requiredDataSources: string[];
  riskLevel: "low" | "medium" | "high";
  checkpoints: string[];
  rollbackPlan: RollbackStep[];
}

export interface RollbackStep {
  taskId: string;
  action: string;
  description: string;
}

export interface DecompositionContext {
  availableLayers: string[];
  availableStandards: string[];
  availableTools: string[];
  systemCapabilities: SystemCapabilities;
}

export interface SystemCapabilities {
  canDownload: boolean;
  canProcess: boolean;
  canExport: boolean;
  canGeoprocess: boolean;
  maxConcurrentTasks: number;
  availableMemory: number;
  availableDiskSpace: number;
}

/**
 * Décompose une demande utilisateur en plan d'exécution
 */
export async function decomposeRequest(
  userRequest: string,
  context: DecompositionContext
): Promise<ExecutionPlan> {
  // Analyser la demande
  const analysis = await analyzeRequest(userRequest);
  
  // Générer les tâches selon l'analyse
  const tasks = generateTasks(analysis, context);
  
  // Ordonner les tâches selon les dépendances
  const orderedTasks = orderTasksByDependencies(tasks);
  
  // Calculer la durée totale estimée
  const estimatedTotalDuration = orderedTasks.reduce(
    (sum, task) => sum + task.estimatedDuration,
    0
  );
  
  // Identifier les normes requises
  const requiredStandards = identifyRequiredStandards(analysis);
  
  // Identifier les sources de données requises
  const requiredDataSources = identifyRequiredDataSources(analysis);
  
  // Évaluer le niveau de risque
  const riskLevel = evaluateRiskLevel(analysis, tasks);
  
  // Générer les points de contrôle
  const checkpoints = generateCheckpoints(orderedTasks);
  
  // Générer le plan de rollback
  const rollbackPlan = generateRollbackPlan(orderedTasks);
  
  return {
    id: `plan-${Date.now()}`,
    userRequest,
    tasks: orderedTasks,
    estimatedTotalDuration,
    requiredStandards,
    requiredDataSources,
    riskLevel,
    checkpoints,
    rollbackPlan,
  };
}

interface RequestAnalysis {
  intent: string;
  domain: string[];
  actions: string[];
  dataSources: string[];
  outputFormat: string;
  complexity: "simple" | "medium" | "complex";
  requiresDownload: boolean;
  requiresProcessing: boolean;
  requiresSymbology: boolean;
  requiresLayout: boolean;
  requiresExport: boolean;
  requiresValidation: boolean;
  scale: string;
  extent?: string;
  timePeriod?: string;
}

/**
 * Analyse la demande utilisateur
 */
async function analyzeRequest(userRequest: string): Promise<RequestAnalysis> {
  const lowerRequest = userRequest.toLowerCase();
  
  const analysis: RequestAnalysis = {
    intent: extractIntent(userRequest),
    domain: extractDomains(lowerRequest),
    actions: extractActions(lowerRequest),
    dataSources: extractDataSources(lowerRequest),
    outputFormat: extractOutputFormat(lowerRequest),
    complexity: assessComplexity(userRequest),
    requiresDownload: lowerRequest.includes("télécharger") || lowerRequest.includes("download") || lowerRequest.includes("charger"),
    requiresProcessing: lowerRequest.includes("traiter") || lowerRequest.includes("process") || lowerRequest.includes("calcul"),
    requiresSymbology: lowerRequest.includes("style") || lowerRequest.includes("symbologie") || lowerRequest.includes("couleur"),
    requiresLayout: lowerRequest.includes("mise en page") || lowerRequest.includes("layout") || lowerRequest.includes("carte"),
    requiresExport: lowerRequest.includes("export") || lowerRequest.includes("pdf") || lowerRequest.includes("imprimer"),
    requiresValidation: lowerRequest.includes("vérifier") || lowerRequest.includes("valider") || lowerRequest.includes("contrôle"),
    scale: extractScale(lowerRequest),
    extent: extractExtent(lowerRequest),
    timePeriod: extractTimePeriod(lowerRequest),
  };
  
  return analysis;
}

function extractIntent(request: string): string {
  // Intentions principales
  if (request.toLowerCase().includes("créer") || request.toLowerCase().includes("générer")) {
    return "create";
  }
  if (request.toLowerCase().includes("analyser") || request.toLowerCase().includes("étudier")) {
    return "analyze";
  }
  if (request.toLowerCase().includes("transformer") || request.toLowerCase().includes("convertir")) {
    return "transform";
  }
  if (request.toLowerCase().includes("exporter") || request.toLowerCase().includes("imprimer")) {
    return "export";
  }
  return "general";
}

function extractDomains(text: string): string[] {
  const domains: string[] = [];
  if (text.includes("forêt") || text.includes("forest")) domains.push("forestry");
  if (text.includes("urban") || text.includes("ville")) domains.push("urban");
  if (text.includes("agriculture") || text.includes("culture")) domains.push("agriculture");
  if (text.includes("environnement") || text.includes("biodiversité")) domains.push("environment");
  if (text.includes("topographie") || text.includes("route")) domains.push("topography");
  if (text.includes("géologie") || text.includes("sol")) domains.push("geology");
  if (text.includes("hydro") || text.includes("eau")) domains.push("hydrology");
  return domains;
}

function extractActions(text: string): string[] {
  const actions: string[] = [];
  if (text.includes("télécharger") || text.includes("download")) actions.push("download");
  if (text.includes("charger") || text.includes("load")) actions.push("load");
  if (text.includes("traiter") || text.includes("process")) actions.push("process");
  if (text.includes("calcul") || text.includes("compute")) actions.push("compute");
  if (text.includes("filtrer") || text.includes("filter")) actions.push("filter");
  if (text.includes("joindre") || text.includes("join")) actions.push("join");
  if (text.includes("buffer") || text.includes("tampon")) actions.push("buffer");
  if (text.includes("intersect") || text.includes("intersection")) actions.push("intersect");
  if (text.includes("union") || text.includes("fusion")) actions.push("union");
  if (text.includes("style") || text.includes("symbologie")) actions.push("style");
  if (text.includes("mise en page") || text.includes("layout")) actions.push("layout");
  if (text.includes("export") || text.includes("pdf")) actions.push("export");
  return actions;
}

function extractDataSources(text: string): string[] {
  const sources: string[] = [];
  if (text.includes("ign")) sources.push("ign");
  if (text.includes("openstreetmap") || text.includes("osm")) sources.push("osm");
  if (text.includes("copernicus") || text.includes("sentinel")) sources.push("copernicus");
  if (text.includes("bd topo") || text.includes("bd ortho")) sources.push("ign_bd");
  if (text.includes("cadastre")) sources.push("cadastre");
  if (text.includes("fichier") || text.includes("shapefile") || text.includes("geojson")) sources.push("local_file");
  return sources;
}

function extractOutputFormat(text: string): string {
  if (text.includes("pdf")) return "pdf";
  if (text.includes("png") || text.includes("image")) return "image";
  if (text.includes("geojson") || text.includes("json")) return "geojson";
  if (text.includes("shapefile") || text.includes("shp")) return "shapefile";
  return "qgis_project";
}

function assessComplexity(request: string): "simple" | "medium" | "complex" {
  const wordCount = request.split(/\s+/).length;
  const actionCount = extractActions(request.toLowerCase()).length;
  
  if (wordCount < 15 && actionCount <= 2) return "simple";
  if (wordCount < 30 && actionCount <= 4) return "medium";
  return "complex";
}

function extractScale(text: string): string {
  if (text.includes("1/2000") || text.includes("1:2000")) return "1/2000";
  if (text.includes("1/5000") || text.includes("1:5000")) return "1/5000";
  if (text.includes("1/10000") || text.includes("1:10000")) return "1/10000";
  if (text.includes("détaillée")) return "detailed";
  if (text.includes("régional")) return "regional";
  if (text.includes("national")) return "national";
  return "unknown";
}

function extractExtent(text: string): string | undefined {
  if (text.includes("forêt de")) {
    const match = text.match(/forêt de\s+([^,.]+)/i);
    return match ? match[1].trim() : undefined;
  }
  if (text.includes("commune de")) {
    const match = text.match(/commune de\s+([^,.]+)/i);
    return match ? match[1].trim() : undefined;
  }
  if (text.includes("département")) {
    const match = text.match(/département\s+(?:de\s+)?([^,.]+)/i);
    return match ? match[1].trim() : undefined;
  }
  return undefined;
}

function extractTimePeriod(text: string): string | undefined {
  if (text.includes("2024") || text.includes("2025")) {
    const match = text.match(/\d{4}/);
    return match ? match[0] : undefined;
  }
  if (text.includes("actuel") || text.includes("courant")) return "current";
  if (text.includes("historique")) return "historical";
  return undefined;
}

/**
 * Génère les tâches selon l'analyse
 */
function generateTasks(analysis: RequestAnalysis, context: DecompositionContext): Task[] {
  const tasks: Task[] = [];
  let taskIdCounter = 0;
  
  // Tâche 1: Acquisition de données (si nécessaire)
  if (analysis.requiresDownload && analysis.dataSources.length > 0) {
    for (const source of analysis.dataSources) {
      tasks.push({
        id: `task-${taskIdCounter++}`,
        type: "data_acquisition",
        description: `Télécharger les données depuis ${source}`,
        dependencies: [],
        estimatedDuration: 5,
        requiredTools: ["download_manager"],
        outputArtifacts: [`${source}_data`],
        parameters: { source, format: "geojson" },
        priority: "high",
        retryCount: 0,
        maxRetries: 3,
      });
    }
  }
  
  // Tâche 2: Chargement des données
  if (analysis.requiresDownload || analysis.dataSources.length > 0) {
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: "data_processing",
      description: "Charger les données dans QGIS",
      dependencies: tasks.slice(-analysis.dataSources.length).map(t => t.id),
      estimatedDuration: 2,
      requiredTools: ["qgis_bridge"],
      outputArtifacts: ["loaded_layers"],
      parameters: {},
      priority: "high",
      retryCount: 0,
      maxRetries: 2,
    });
  }
  
  // Tâche 3: Traitement des données (si nécessaire)
  if (analysis.requiresProcessing) {
    const processingTasks = generateProcessingTasks(analysis, taskIdCounter);
    tasks.push(...processingTasks.tasks);
    taskIdCounter = processingTasks.nextId;
  }
  
  // Tâche 4: Application de la symbologie (si nécessaire)
  if (analysis.requiresSymbology) {
    const lastTaskId = tasks.length > 0 ? tasks[tasks.length - 1].id : "";
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: "symbology",
      description: "Appliquer la symbologie selon les normes",
      dependencies: lastTaskId ? [lastTaskId] : [],
      estimatedDuration: 3,
      requiredTools: ["symbology_applier", "standard_matcher"],
      outputArtifacts: ["styled_layers"],
      parameters: {
        standards: analysis.domain,
      },
      priority: "high",
      retryCount: 0,
      maxRetries: 2,
    });
  }
  
  // Tâche 5: Création de la mise en page (si nécessaire)
  if (analysis.requiresLayout) {
    const lastTaskId = tasks.length > 0 ? tasks[tasks.length - 1].id : "";
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: "layout",
      description: "Créer la mise en page de la carte",
      dependencies: lastTaskId ? [lastTaskId] : [],
      estimatedDuration: 5,
      requiredTools: ["layout_engine"],
      outputArtifacts: ["map_layout"],
      parameters: {
        format: analysis.outputFormat,
        scale: analysis.scale,
      },
      priority: "high",
      retryCount: 0,
      maxRetries: 2,
    });
  }
  
  // Tâche 6: Export (si nécessaire)
  if (analysis.requiresExport) {
    const lastTaskId = tasks.length > 0 ? tasks[tasks.length - 1].id : "";
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: "export",
      description: `Exporter la carte en ${analysis.outputFormat}`,
      dependencies: lastTaskId ? [lastTaskId] : [],
      estimatedDuration: 2,
      requiredTools: ["export_manager"],
      outputArtifacts: [`exported_${analysis.outputFormat}`],
      parameters: {
        format: analysis.outputFormat,
        quality: "high",
      },
      priority: "high",
      retryCount: 0,
      maxRetries: 2,
    });
  }
  
  // Tâche 7: Validation (si nécessaire)
  if (analysis.requiresValidation || analysis.complexity === "complex") {
    const lastTaskId = tasks.length > 0 ? tasks[tasks.length - 1].id : "";
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: "validation",
      description: "Valider le résultat final",
      dependencies: lastTaskId ? [lastTaskId] : [],
      estimatedDuration: 3,
      requiredTools: ["validator"],
      outputArtifacts: ["validation_report"],
      parameters: {
        checks: ["completeness", "accuracy", "compliance"],
      },
      priority: "medium",
      retryCount: 0,
      maxRetries: 1,
    });
  }
  
  return tasks;
}

interface ProcessingTasksResult {
  tasks: Task[];
  nextId: number;
}

function generateProcessingTasks(analysis: RequestAnalysis, startId: number): ProcessingTasksResult {
  const tasks: Task[] = [];
  let taskIdCounter = startId;
  const lastTaskId = tasks.length > 0 ? tasks[tasks.length - 1].id : "";
  
  for (const action of analysis.actions) {
    let taskType: TaskType;
    let description: string;
    let tools: string[];
    
    switch (action) {
      case "buffer":
        taskType = "geoprocessing";
        description = "Créer un buffer autour des entités";
        tools = ["geoprocessing_buffer"];
        break;
      case "intersect":
        taskType = "geoprocessing";
        description = "Calculer l'intersection des couches";
        tools = ["geoprocessing_intersect"];
        break;
      case "union":
        taskType = "geoprocessing";
        description = "Fusionner les couches";
        tools = ["geoprocessing_union"];
        break;
      case "filter":
        taskType = "data_processing";
        description = "Filtrer les données";
        tools = ["data_filter"];
        break;
      case "join":
        taskType = "attribute_management";
        description = "Joindre les attributs";
        tools = ["attribute_join"];
        break;
      case "compute":
      case "calcul":
        taskType = "attribute_management";
        description = "Calculer de nouveaux champs";
        tools = ["field_calculator"];
        break;
      default:
        taskType = "data_processing";
        description = `Traiter: ${action}`;
        tools = ["data_processing"];
    }
    
    tasks.push({
      id: `task-${taskIdCounter++}`,
      type: taskType,
      description,
      dependencies: lastTaskId ? [lastTaskId] : [],
      estimatedDuration: 3,
      requiredTools: tools,
      outputArtifacts: [`${action}_result`],
      parameters: { action },
      priority: "medium",
      retryCount: 0,
      maxRetries: 2,
    });
  }
  
  return { tasks, nextId: taskIdCounter };
}

/**
 * Ordonne les tâches selon les dépendances
 */
function orderTasksByDependencies(tasks: Task[]): Task[] {
  const ordered: Task[] = [];
  const remaining = [...tasks];
  const processed = new Set<string>();
  
  while (remaining.length > 0) {
    // Trouver les tâches sans dépendances non traitées
    const ready = remaining.filter(task =>
      task.dependencies.every(dep => processed.has(dep))
    );
    
    if (ready.length === 0) {
      // Cycle de dépendances, prendre la première
      const task = remaining.shift()!;
      ordered.push(task);
      processed.add(task.id);
      continue;
    }
    
    // Ajouter les tâches prêtes
    for (const task of ready) {
      ordered.push(task);
      processed.add(task.id);
      const index = remaining.indexOf(task);
      remaining.splice(index, 1);
    }
  }
  
  return ordered;
}

/**
 * Identifie les normes requises
 */
function identifyRequiredStandards(analysis: RequestAnalysis): string[] {
  const standards: string[] = [];
  
  if (analysis.domain.includes("forestry")) {
    standards.push("onf-2024", "cnpf-2024", "psg-2023");
  }
  if (analysis.domain.includes("topography")) {
    standards.push("ign-2024");
  }
  if (analysis.domain.includes("geology")) {
    standards.push("brgm-2024");
  }
  if (analysis.domain.includes("agriculture")) {
    standards.push("inrae-2023");
  }
  if (analysis.domain.includes("environment")) {
    standards.push("dreal-2023", "ofb-2024");
  }
  
  return [...new Set(standards)];
}

/**
 * Identifie les sources de données requises
 */
function identifyRequiredDataSources(analysis: RequestAnalysis): string[] {
  return analysis.dataSources;
}

/**
 * Évalue le niveau de risque
 */
function evaluateRiskLevel(analysis: RequestAnalysis, tasks: Task[]): "low" | "medium" | "high" {
  if (analysis.complexity === "simple" && tasks.length <= 3) {
    return "low";
  }
  if (analysis.complexity === "medium" || tasks.length <= 6) {
    return "medium";
  }
  return "high";
}

/**
 * Génère les points de contrôle
 */
function generateCheckpoints(tasks: Task[]): string[] {
  const checkpoints: string[] = [];
  
  // Checkpoint après chaque étape majeure
  const majorSteps = tasks.filter(t => t.priority === "high");
  for (const task of majorSteps) {
    checkpoints.push(`checkpoint-after-${task.id}`);
  }
  
  // Checkpoint final
  if (tasks.length > 0) {
    checkpoints.push(`checkpoint-final`);
  }
  
  return checkpoints;
}

/**
 * Génère le plan de rollback
 */
function generateRollbackPlan(tasks: Task[]): RollbackStep[] {
  const rollbackSteps: RollbackStep[] = [];
  
  // Pour chaque tâche, définir l'action de rollback
  for (const task of tasks) {
    let action: string;
    
    switch (task.type) {
      case "data_acquisition":
        action = "delete_downloaded_files";
        break;
      case "data_processing":
        action = "remove_processed_layers";
        break;
      case "symbology":
        action = "reset_symbology";
        break;
      case "layout":
        action = "remove_layout";
        break;
      case "export":
        action = "delete_exported_files";
        break;
      default:
        action = "revert_changes";
    }
    
    rollbackSteps.push({
      taskId: task.id,
      action,
      description: `Rollback de ${task.description}`,
    });
  }
  
  // Inverser l'ordre pour le rollback
  return rollbackSteps.reverse();
}

/**
 * Helper pour valider un plan d'exécution
 */
export function validatePlan(plan: ExecutionPlan): boolean {
  // Vérifier qu'il y a des tâches
  if (plan.tasks.length === 0) {
    return false;
  }
  
  // Vérifier que les dépendances sont valides
  const taskIds = new Set(plan.tasks.map(t => t.id));
  for (const task of plan.tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        return false;
      }
    }
  }
  
  // Vérifier qu'il n'y a pas de cycles
  return !hasCycle(plan.tasks);
}

/**
 * Détecte les cycles dans les dépendances
 */
function hasCycle(tasks: Task[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function visit(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      return true; // Cycle détecté
    }
    if (visited.has(taskId)) {
      return false;
    }
    
    visited.add(taskId);
    recursionStack.add(taskId);
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      for (const dep of task.dependencies) {
        if (visit(dep)) {
          return true;
        }
      }
    }
    
    recursionStack.delete(taskId);
    return false;
  }
  
  for (const task of tasks) {
    if (visit(task.id)) {
      return true;
    }
  }
  
  return false;
}
