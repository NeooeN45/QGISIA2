import { useState } from "react";
import { ChevronRight, Map, Satellite, FolderTree, Calculator, Layers, MapPin, Globe, CheckCircle2, Loader2, Sparkles, ArrowRight, ArrowLeft, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "zone",
    title: "1. Zone d'étude",
    description: "Définissez votre zone géographique de travail",
    icon: <Map size={20} />,
    color: "emerald",
  },
  {
    id: "data",
    title: "2. Données",
    description: "Chargez les couches géographiques nécessaires",
    icon: <Layers size={20} />,
    color: "sky",
  },
  {
    id: "analysis",
    title: "3. Analyse",
    description: "Effectuez des calculs et traitements",
    icon: <Calculator size={20} />,
    color: "rose",
  },
];

interface DataCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: "terrain" | "satellite" | "local" | "external";
  action: () => void;
}

const DATA_CARDS: DataCard[] = [
  {
    id: "cadastre",
    title: "Cadastre",
    description: "Parcelles et limites communales",
    icon: <MapPin size={24} />,
    color: "emerald",
    category: "terrain",
    action: () => console.log("Load cadastre"),
  },
  {
    id: "satellite",
    title: "Satellites",
    description: "Images Sentinel-2 et Landsat",
    icon: <Satellite size={24} />,
    color: "sky",
    category: "satellite",
    action: () => console.log("Load satellite"),
  },
  {
    id: "osm",
    title: "OpenStreetMap",
    description: "Données vectorielles (routes, bâtiments...)",
    icon: <Globe size={24} />,
    color: "orange",
    category: "external",
    action: () => console.log("Load OSM"),
  },
  {
    id: "local",
    title: "Fichiers locaux",
    description: "GeoTIFF, Shapefile, GeoJSON...",
    icon: <FolderTree size={24} />,
    color: "amber",
    category: "local",
    action: () => console.log("Load local file"),
  },
];

interface WorkflowWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onStepChange?: (step: string) => void;
}

export default function WorkflowWizard({ isOpen, onClose, onStepChange }: WorkflowWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleNext = () => {
    if (currentStep < WORKFLOW_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(WORKFLOW_STEPS[nextStep].id);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(WORKFLOW_STEPS[prevStep].id);
    }
  };

  const handleCardClick = (card: DataCard) => {
    setIsLoading(true);
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
      card.action();
    }, 1000);
  };

  const filteredCards = selectedCategory
    ? DATA_CARDS.filter((card) => card.category === selectedCategory)
    : DATA_CARDS;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="border-b border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-white/10">
                <Sparkles size={16} className="text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Workflow guidé</p>
                <p className="text-[10px] text-white/40">Assistant intelligent</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-1 px-4 py-4">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => {
                    setCurrentStep(index);
                    onStepChange?.(step.id);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-300",
                    currentStep === index
                      ? `bg-${step.color}-500 text-white shadow-lg shadow-${step.color}-500/30 ring-2 ring-${step.color}-500/20`
                      : currentStep > index
                        ? "bg-emerald-500 text-white"
                        : "bg-white/5 text-white/40 hover:bg-white/10",
                  )}
                >
                  {currentStep > index ? <CheckCircle2 size={16} /> : index + 1}
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "text-[11px] font-semibold truncate transition-colors duration-300",
                      currentStep === index ? "text-white" : "text-white/40",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-[9px] text-white/30 truncate">{step.description}</span>
                </div>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight size={12} className="text-white/20 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="px-4 pb-4">
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/80">
                      <Map size={14} className="text-emerald-300" />
                      Commune ou zone d'étude
                    </label>
                    <input
                      type="text"
                      placeholder="Tapez le nom d'une commune (ex: Rennes, Paris...)"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-3 py-2.5 text-xs font-semibold text-emerald-100 transition-all hover:bg-emerald-500/18 hover:shadow-lg hover:shadow-emerald-500/10">
                        <Map size={16} />
                        Contours
                      </button>
                      <button className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/12 px-3 py-2.5 text-xs font-semibold text-orange-100 transition-all hover:bg-orange-500/18 hover:shadow-lg hover:shadow-orange-500/10">
                        <MapPin size={16} />
                        Parcelles
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  {/* Category Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[
                      { id: null, label: "Tout", color: "white" },
                      { id: "terrain", label: "Terrain", color: "emerald" },
                      { id: "satellite", label: "Satellites", color: "sky" },
                      { id: "local", label: "Local", color: "amber" },
                      { id: "external", label: "Externe", color: "cyan" },
                    ].map((cat) => (
                      <button
                        key={cat.id || "all"}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-300",
                          selectedCategory === cat.id
                            ? `border-${cat.color}-500/30 bg-${cat.color}-500/12 text-${cat.color}-100 shadow-lg shadow-${cat.color}-500/10`
                            : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70",
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Data Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    {filteredCards.map((card) => (
                      <motion.button
                        key={card.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCardClick(card)}
                        disabled={isLoading}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-300",
                          `border-${card.color}-500/20 bg-${card.color}-500/8 hover:bg-${card.color}-500/12 hover:shadow-lg hover:shadow-${card.color}-500/10`,
                          isLoading && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {isLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <Loader2 size={20} className="animate-spin text-white" />
                          </div>
                        )}
                        <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-${card.color}-500/30 bg-${card.color}-500/20 text-${card.color}-300`}>
                          {card.icon}
                        </div>
                        <p className="text-xs font-semibold text-white">{card.title}</p>
                        <p className="mt-1 text-[10px] text-white/50 line-clamp-2">{card.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs text-white/60 mb-3">
                      Sélectionnez une analyse à effectuer
                    </p>
                    <div className="space-y-2">
                      {[
                        { icon: Calculator, title: "NDVI", desc: "Indice de végétation", color: "rose" },
                        { icon: Layers, title: "Fusion raster", desc: "Combinez plusieurs images", color: "violet" },
                        { icon: Calculator, title: "Calculateur", desc: "Formules personnalisées", color: "fuchsia" },
                      ].map((tool) => (
                        <button
                          key={tool.title}
                          className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-white/5 group"
                        >
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border border-${tool.color}-500/30 bg-${tool.color}-500/20 text-${tool.color}-300 group-hover:scale-110 transition-transform`}>
                            <tool.icon size={16} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-white">{tool.title}</p>
                            <p className="text-[10px] text-white/50">{tool.desc}</p>
                          </div>
                          <ArrowRight size={14} className="text-white/30 group-hover:text-white/60 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-300",
                  currentStep === 0
                    ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white hover:shadow-lg hover:shadow-white/5",
                )}
              >
                <ArrowLeft size={14} />
                Précédent
              </button>
              <button
                onClick={handleNext}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-300",
                  currentStep === WORKFLOW_STEPS.length - 1
                    ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18 hover:shadow-lg hover:shadow-emerald-500/10"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white hover:shadow-lg hover:shadow-white/5",
                )}
              >
                {currentStep === WORKFLOW_STEPS.length - 1 ? "Terminer" : "Suivant"}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
