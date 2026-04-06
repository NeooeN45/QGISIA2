import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, Sparkles, Zap, Shield, Layers3 } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface IntroAnimationProps {
  onComplete: () => void;
  isFirstTime?: boolean;
}

export default function IntroAnimation({ onComplete, isFirstTime = false }: IntroAnimationProps) {
  const [step, setStep] = useState(0);
  const [isSkipped, setIsSkipped] = useState(false);

  const slides = [
    {
      icon: <Sparkles size={48} className="text-emerald-400" />,
      title: "Bienvenue sur GeoSylva AI",
      description: "Votre assistant intelligent pour QGIS",
      color: "emerald",
    },
    {
      icon: <Layers3 size={48} className="text-sky-400" />,
      title: "Données géographiques",
      description: "Accédez aux sources officielles IGN, Copernicus, et plus encore",
      color: "sky",
    },
    {
      icon: <Zap size={48} className="text-amber-400" />,
      title: "Automatisation intelligente",
      description: "L'IA génère et exécute automatiquement vos scripts PyQGIS",
      color: "amber",
    },
    {
      icon: <Shield size={48} className="text-violet-400" />,
      title: "Sécurité locale",
      description: "Vos données restent sur votre machine, rien n'est envoyé dans le cloud",
      color: "violet",
    },
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      if (isFirstTime) {
        localStorage.setItem("geosylva-intro-seen", "true");
      }
      setIsSkipped(true);
      setTimeout(() => onComplete(), 300);
    }
  };

  const handleSkip = () => {
    if (isFirstTime) {
      localStorage.setItem("geosylva-intro-seen", "true");
    }
    setIsSkipped(true);
    setTimeout(() => onComplete(), 300);
  };

  useEffect(() => {
    if (!isFirstTime) {
      // Auto-skip after 2 seconds if not first time
      const timer = setTimeout(() => {
        setIsSkipped(true);
        setTimeout(() => onComplete(), 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime, onComplete]);

  return (
    <AnimatePresence mode="wait">
      {!isSkipped && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#131314]"
        >
          <div className="absolute inset-0 bg-mesh" />
          
          <div className="relative z-10 w-full max-w-4xl px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-white/10">
                  <Sparkles size={20} className="text-emerald-300" />
                </div>
                <span className="text-sm font-bold text-white/60">GeoSylva AI</span>
              </div>
              {isFirstTime && (
                <button
                  onClick={handleSkip}
                  className="text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Passer
                </button>
              )}
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 md:p-12">
              <AnimatePresence mode="wait">
                {slides.map((slide, index) => (
                  step === index && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      className="text-center"
                    >
                      <div className="mb-8 flex justify-center">
                        <div className={cn(
                          "flex h-24 w-24 items-center justify-center rounded-3xl border bg-gradient-to-br",
                          `from-${slide.color}-500/20 to-${slide.color}-500/5`,
                          `border-${slide.color}-500/30`
                        )}>
                          {slide.icon}
                        </div>
                      </div>
                      <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                        {slide.title}
                      </h2>
                      <p className="text-lg text-white/60 md:text-xl">
                        {slide.description}
                      </p>
                    </motion.div>
                  )
                ))}
              </AnimatePresence>

              {/* Progress dots */}
              <div className="mt-12 flex items-center justify-center gap-2">
                {slides.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      step === index
                        ? `w-8 bg-${slides[step].color}-500`
                        : "w-2 bg-white/20"
                    )}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-center">
                <button
                  onClick={handleNext}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-semibold transition-all",
                    step === slides.length - 1
                      ? `border-emerald-500/30 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18`
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {step === slides.length - 1 ? "Commencer" : "Suivant"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
