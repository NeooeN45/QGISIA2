/**
 * Modal pour les templates de scripts PyQGIS réutilisables
 * Interface pour sélectionner, paramétrer et exécuter des templates
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Trees,
  BarChart3,
  Settings,
  Database,
  Palette,
  Download,
  Upload,
  User,
  ChevronRight,
  Play,
  FileCode,
  Clock,
  CheckCircle,
  AlertCircle,
  Layers,
  FileText,
  Copy,
  Save,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  BUILTIN_TEMPLATES,
  ScriptTemplate,
  TemplateParameter,
  fillTemplate,
  validateParameter,
  generatePreview,
  getTemplateCategories,
  searchTemplates,
} from "../lib/script-templates";

interface ScriptTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (code: string, templateName: string) => void;
  availableLayers: string[];
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Trees,
  BarChart3,
  Settings,
  Database,
  Palette,
  Download,
  Upload,
  User,
};

export default function ScriptTemplateModal({
  isOpen,
  onClose,
  onExecute,
  availableLayers,
}: ScriptTemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"params" | "preview" | "code">("params");

  const categories = getTemplateCategories();

  const filteredTemplates = useMemo(() => {
    let templates = BUILTIN_TEMPLATES;
    
    if (selectedCategory !== "all") {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }
    
    return templates;
  }, [selectedCategory, searchQuery]);

  const handleTemplateSelect = (template: ScriptTemplate) => {
    setSelectedTemplate(template);
    
    // Initialiser les valeurs par défaut
    const defaults: Record<string, any> = {};
    template.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        defaults[param.id] = param.defaultValue;
      }
      // Pour les layers, suggérer la première couche disponible
      if (param.type === "layer" && availableLayers.length > 0) {
        defaults[param.id] = availableLayers[0];
      }
    });
    setParameterValues(defaults);
    setValidationErrors({});
    setActiveTab("params");
  };

  const handleParameterChange = (paramId: string, value: any) => {
    setParameterValues(prev => ({ ...prev, [paramId]: value }));
    
    // Valider
    const param = selectedTemplate?.parameters.find(p => p.id === paramId);
    if (param) {
      const error = validateParameter(param, value);
      setValidationErrors(prev => ({
        ...prev,
        [paramId]: error || "",
      }));
    }
  };

  const handleExecute = () => {
    if (!selectedTemplate) return;
    
    // Valider tous les paramètres
    const errors: Record<string, string> = {};
    selectedTemplate.parameters.forEach(param => {
      const error = validateParameter(param, parameterValues[param.id]);
      if (error) errors[param.id] = error;
    });
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    const code = fillTemplate(selectedTemplate, parameterValues);
    onExecute(code, selectedTemplate.name);
    onClose();
  };

  const renderParameterInput = (param: TemplateParameter) => {
    const value = parameterValues[param.id];
    const error = validationErrors[param.id];
    
    switch (param.type) {
      case "layer":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleParameterChange(param.id, e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2",
              error 
                ? "border-red-500/50 focus:ring-red-500/50" 
                : "border-white/10 focus:ring-emerald-500/50"
            )}
          >
            <option value="">Sélectionner une couche...</option>
            {availableLayers.map(layer => (
              <option key={layer} value={layer}>{layer}</option>
            ))}
          </select>
        );
        
      case "number":
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value || ""}
              min={param.min}
              max={param.max}
              step={param.step}
              onChange={(e) => handleParameterChange(param.id, e.target.value)}
              className={cn(
                "flex-1 px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2",
                error 
                  ? "border-red-500/50 focus:ring-red-500/50" 
                  : "border-white/10 focus:ring-emerald-500/50"
              )}
            />
            {param.step && (
              <div className="flex flex-col">
                <button
                  onClick={() => handleParameterChange(param.id, (Number(value) || 0) + (param.step || 1))}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleParameterChange(param.id, (Number(value) || 0) - (param.step || 1))}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        );
        
      case "text":
        return (
          <input
            type="text"
            value={value || ""}
            placeholder={param.defaultValue}
            onChange={(e) => handleParameterChange(param.id, e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2",
              error 
                ? "border-red-500/50 focus:ring-red-500/50" 
                : "border-white/10 focus:ring-emerald-500/50"
            )}
          />
        );
        
      case "choice":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleParameterChange(param.id, e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2",
              error 
                ? "border-red-500/50 focus:ring-red-500/50" 
                : "border-white/10 focus:ring-emerald-500/50"
            )}
          >
            {param.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
        
      case "boolean":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleParameterChange(param.id, e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50"
            />
            <span className="text-sm text-white/70">Activer</span>
          </label>
        );
        
      default:
        return (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleParameterChange(param.id, e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2",
              error 
                ? "border-red-500/50 focus:ring-red-500/50" 
                : "border-white/10 focus:ring-emerald-500/50"
            )}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[85vh] bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30">
                <FileCode size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Templates de Scripts</h2>
                <p className="text-xs text-white/50">Scripts PyQGIS réutilisables et paramétrables</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar - Catégories et recherche */}
            <div className="w-64 border-r border-white/10 bg-gray-900/50 flex flex-col">
              {/* Recherche */}
              <div className="p-4 border-b border-white/10">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Catégories */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedCategory === "all"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-white/70 hover:bg-white/5"
                  )}
                >
                  <Layers size={16} />
                  Tous les templates
                  <span className="ml-auto text-xs text-white/40">{BUILTIN_TEMPLATES.length}</span>
                </button>

                {categories.map(cat => {
                  const Icon = iconMap[cat.icon] || FileCode;
                  const count = BUILTIN_TEMPLATES.filter(t => t.category === cat.id).length;
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                        selectedCategory === cat.id
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "text-white/70 hover:bg-white/5"
                      )}
                    >
                      <Icon size={16} />
                      {cat.name}
                      <span className="ml-auto text-xs text-white/40">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedTemplate ? (
                /* Liste des templates */
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 gap-3">
                    {filteredTemplates.map(template => {
                      const Icon = iconMap[categories.find(c => c.id === template.category)?.icon || "FileCode"] || FileCode;
                      
                      return (
                        <motion.button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="flex items-start gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all text-left group"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40">
                            <Icon size={24} className="text-emerald-400" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                                {template.name}
                              </h3>
                              {template.requiresConfirmation && (
                                <span title="Nécessite confirmation">
                                  <AlertCircle size={14} className="text-amber-400" />
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white/50 line-clamp-2">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              {template.estimatedDuration && (
                                <span className="flex items-center gap-1 text-xs text-white/40">
                                  <Clock size={12} />
                                  {template.estimatedDuration}
                                </span>
                              )}
                              <span className="text-xs text-white/40">
                                {template.parameters.length} paramètre{template.parameters.length > 1 ? "s" : ""}
                              </span>
                              <div className="flex gap-1">
                                {template.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/40">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight size={20} className="text-white/20 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Détail du template */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Header du template */}
                  <div className="px-6 py-4 border-b border-white/10">
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 mb-2"
                    >
                      <ChevronRight size={16} className="rotate-180" />
                      Retour aux templates
                    </button>
                    <h3 className="text-xl font-semibold text-white">{selectedTemplate.name}</h3>
                    <p className="text-sm text-white/60 mt-1">{selectedTemplate.description}</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-white/10">
                    {[
                      { id: "params", label: "Paramètres", icon: Settings },
                      { id: "preview", label: "Aperçu", icon: FileText },
                      { id: "code", label: "Code", icon: FileCode },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                          activeTab === tab.id
                            ? "text-emerald-400 border-emerald-400"
                            : "text-white/50 border-transparent hover:text-white/80"
                        )}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "params" && (
                      <div className="space-y-4">
                        {selectedTemplate.parameters.map(param => (
                          <div key={param.id} className="space-y-2">
                            <label className="block text-sm font-medium text-white/80">
                              {param.name}
                              {param.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <p className="text-xs text-white/40">{param.description}</p>
                            {renderParameterInput(param)}
                            {validationErrors[param.id] && (
                              <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {validationErrors[param.id]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === "preview" && (
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-white/10">
                          <h4 className="text-sm font-medium text-white/80 mb-2">Aperçu du code</h4>
                          <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap">
                            {generatePreview(selectedTemplate, parameterValues)}
                          </pre>
                        </div>
                        {selectedTemplate.exampleUsage && (
                          <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <h4 className="text-sm font-medium text-emerald-400 mb-1">Exemple d'utilisation</h4>
                            <p className="text-sm text-white/60">{selectedTemplate.exampleUsage}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "code" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-white/80">Code PyQGIS généré</h4>
                          <button
                            onClick={() => {
                              const code = fillTemplate(selectedTemplate, parameterValues);
                              navigator.clipboard.writeText(code);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/70 transition-colors"
                          >
                            <Copy size={14} />
                            Copier
                          </button>
                        </div>
                        <pre className="p-4 bg-gray-950 rounded-lg border border-white/10 text-xs text-white/70 font-mono whitespace-pre-wrap overflow-auto max-h-96">
                          {fillTemplate(selectedTemplate, parameterValues)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Footer avec actions */}
                  <div className="px-6 py-4 border-t border-white/10 bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      {selectedTemplate.requiresConfirmation ? (
                        <>
                          <AlertCircle size={16} className="text-amber-400" />
                          Nécessite votre confirmation avant exécution
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} className="text-emerald-400" />
                          Exécution directe
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedTemplate(null)}
                        className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleExecute}
                        disabled={Object.keys(validationErrors).some(k => validationErrors[k])}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-all"
                      >
                        <Play size={16} />
                        Exécuter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
