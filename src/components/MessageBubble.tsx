import { lazy, Suspense } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Sparkles, User, ThumbsUp, ThumbsDown, ExternalLink, Camera } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ChatMessage } from "../lib/chat-history";
import CodeBlock from "./CodeBlock";
import { useConversationStore } from "../stores/useConversationStore";
import { parseReasoning } from "../lib/reasoning-parser";
import ReasoningPhasesView from "./ReasoningPhasesView";
import { useMapData } from "../hooks/useMapData";

// Chargement différé : Leaflet (~150 kB) n'est inclus que si une carte est affichée
const InlineMap = lazy(() => import("./InlineMap"));

// Regex pour détecter les data URLs d'images PNG
const DATA_URL_REGEX = /^data:image\/png;base64,/;
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\((data:image\/png;base64,[^)]+)\)/;

/** Extrait la data URL d'une image du contenu markdown ou retourne null */
function extractDataUrl(content: string): string | null {
  // Si le contenu commence directement par une data URL
  if (DATA_URL_REGEX.test(content)) {
    return content;
  }

  // Sinon chercher un pattern markdown image
  const match = MARKDOWN_IMAGE_REGEX.exec(content);
  if (match?.[2]) {
    return match[2];
  }

  return null;
}

/** Composant pour afficher une capture de carte QGIS */
function MapCapture({ dataUrl }: { dataUrl: string }) {
  const handleOpenInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head><title>Capture QGIS</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;">
            <img src="${dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.0, 0, 0.2, 1] }}
      className="relative mt-3 overflow-hidden rounded-xl border border-white/10 shadow-lg"
    >
      {/* Badge "Capture carte QGIS" */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
        <Camera size={12} />
        <span>Capture carte QGIS</span>
      </div>

      {/* Bouton "Ouvrir en grand" */}
      <button
        onClick={handleOpenInNewTab}
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/80"
      >
        <ExternalLink size={12} />
        <span>Ouvrir en grand</span>
      </button>

      {/* Image */}
      <img
        src={dataUrl}
        alt="Capture de la carte QGIS"
        className="max-w-full"
        loading="lazy"
      />
    </motion.div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

// Animation variants pour les entrées de messages
const userMessageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
};

const assistantMessageVariants = {
  initial: { opacity: 0, x: -12, y: 8 },
  animate: { opacity: 1, x: 0, y: 0 },
};

const messageTransition = {
  duration: 0.3,
  ease: [0.0, 0, 0.2, 1] as const,
};

// Animation pour les boutons feedback
const feedbackButtonsVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

const feedbackTransition = {
  duration: 0.25,
  delay: 0.5,
  ease: [0.0, 0, 0.2, 1] as const,
};

// Formatter le timestamp
function formatTimestamp(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const setMessageFeedback = useConversationStore((s) => s.setMessageFeedback);

  const handleFeedback = (feedback: "like" | "dislike" | null) => {
    setMessageFeedback(message.id, feedback);
  };

  const isUser = message.role === "user";
  const timestamp = formatTimestamp(message.createdAt);

  // Vérifier si le message contient une capture de carte
  const dataUrl = !isUser ? extractDataUrl(message.content) : null;
  // Si c'est uniquement une data URL, pas besoin de markdown
  const isPureDataUrl = DATA_URL_REGEX.test(message.content.trim());

  // Extraire les blocs <map-data> et nettoyer le contenu pour le markdown
  const { cleanContent, mapDataList } = useMapData(isUser ? "" : message.content);
  const hasMapData = mapDataList.length > 0;
  // Contenu à passer au markdown : version nettoyée si des cartes sont présentes
  const markdownContent = hasMapData ? cleanContent : message.content;

  return (
    <motion.div
      key={message.id}
      variants={isUser ? userMessageVariants : assistantMessageVariants}
      initial="initial"
      animate="animate"
      transition={messageTransition}
      className={cn(
        "flex gap-4 md:gap-6",
        isUser ? "flex-row-reverse" : "",
      )}
    >
      {/* Avatar Container */}
      <div className="relative shrink-0">
        {isUser ? (
          // Avatar User avec gradient animé
          <motion.div
            className="group relative mt-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl shadow-xl"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fond avec gradient animé */}
            <div className="absolute inset-0 animate-gradient-shift bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-600 bg-[length:200%_200%]" />
            {/* Bordure glow au hover */}
            <div className="absolute -inset-[1px] rounded-2xl bg-blue-400/0 transition-all duration-300 group-hover:bg-blue-400/30 group-hover:blur-sm" />
            <User size={20} className="relative z-10 text-white" />
          </motion.div>
        ) : (
          // Avatar Assistant avec rotation lente et gradient subtil
          <motion.div
            className="group relative mt-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-gray-300 bg-gray-200 shadow-xl dark:border-[#333537] dark:bg-[#1a1a1b]"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fond gradient subtil animé */}
            <div className="absolute inset-0 animate-gradient-loop bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-blue-500/10 bg-[length:200%_200%] dark:from-blue-400/10 dark:via-violet-400/10 dark:to-blue-400/10" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Sparkles size={18} className="relative z-10 text-blue-500 dark:text-blue-400" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Content Container */}
      <div
        className={cn(
          "min-w-0 flex-1",
          isUser ? "text-right" : "",
        )}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            "prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0",
            "prose-strong:text-blue-700 dark:prose-strong:text-blue-300",
            "prose-code:text-blue-700 dark:prose-code:text-blue-300",
            isUser
              ? "inline-block rounded-[24px_24px_8px_24px] border border-blue-500/20 bg-gradient-to-br from-blue-600/12 to-indigo-600/8 px-5 py-4 text-left shadow-xl backdrop-blur-sm dark:border-blue-400/15 dark:from-blue-500/15 dark:to-indigo-500/10"
              : "",
          )}
        >
          {!isUser && parseReasoning(message.content).hasStructuredReasoning ? (
            <ReasoningPhasesView text={message.content} />
          ) : dataUrl && isPureDataUrl ? (
            // Message avec uniquement une capture de carte
            <MapCapture dataUrl={dataUrl} />
          ) : (
            <>
              <ReactMarkdown
                components={{
                  code({ className, children, ...codeProps }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match;

                    return !isInline ? (
                      <CodeBlock
                        language={match[1]}
                        value={String(children).replace(/\n$/, "")}
                      />
                    ) : (
                      <code
                        className={cn(
                          "rounded-md bg-gray-200 px-2 py-0.5 font-mono text-xs font-bold text-blue-600 dark:bg-[#333537] dark:text-blue-300",
                          className,
                        )}
                        {...codeProps}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {markdownContent}
              </ReactMarkdown>

              {/* Cartes inline issues des blocs <map-data> */}
              {hasMapData && (
                <Suspense
                  fallback={
                    <div className="my-3 flex h-16 items-center justify-center rounded-xl border border-white/10 bg-[#111315] text-xs text-white/30">
                      Chargement de la carte…
                    </div>
                  }
                >
                  {mapDataList.map((mapProps, idx) => (
                    <InlineMap key={idx} {...mapProps} />
                  ))}
                </Suspense>
              )}

              {/* Afficher la capture si présente dans le contenu */}
              {dataUrl && !isPureDataUrl && <MapCapture dataUrl={dataUrl} />}
            </>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className={cn(
              "mt-1 text-[10px] text-gray-500 dark:text-white/30",
              isUser ? "text-right pr-1" : "text-left pl-1",
            )}
          >
            {timestamp}
          </motion.div>
        )}

        {/* Feedback Buttons - Assistant only */}
        {!isUser && (
          <motion.div
            variants={feedbackButtonsVariants}
            initial="initial"
            animate="animate"
            transition={feedbackTransition}
            className="mt-2 flex items-center gap-2"
          >
            <motion.button
              onClick={() => handleFeedback(message.feedback === "like" ? null : "like")}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                message.feedback === "like"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "border-gray-300 bg-gray-100 text-gray-500 hover:border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:text-emerald-200",
              )}
              title="Cette réponse est utile"
            >
              <ThumbsUp size={12} />
              <span>Utile</span>
            </motion.button>
            <motion.button
              onClick={() => handleFeedback(message.feedback === "dislike" ? null : "dislike")}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                message.feedback === "dislike"
                  ? "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300"
                  : "border-gray-300 bg-gray-100 text-gray-500 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:text-red-200",
              )}
              title="Cette réponse n'est pas utile"
            >
              <ThumbsDown size={12} />
              <span>Pas utile</span>
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
