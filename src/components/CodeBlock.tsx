import { useState, useEffect } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";

import { runScript } from "../lib/qgis";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("typescript", typescript);

interface CodeBlockProps {
  language: string;
  value: string;
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Code copié dans le presse-papier");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le code (permission refusée)");
    }
  };

  const runInQgis = async () => {
    const status = await runScript(value, { requireConfirmation: false });

    if (status) {
      toast.success(status);
    } else {
      toast.error("QGIS n'est pas connecté. Utilisez cette extension dans QGIS.");
    }
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-[#333537] shadow-lg dark:shadow-2xl transition-all duration-500 hover:border-blue-500/30">
      <div className="relative flex items-center justify-between border-b border-gray-200 dark:border-[#333537] bg-gray-50 dark:bg-[#1a1a1b] px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-[#8e918f]">
            {language || "python"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void copyToClipboard()}
            className="rounded-md p-1.5 text-gray-500 dark:text-[#c4c7c5] transition-colors hover:bg-gray-200 dark:hover:bg-[#333537] hover:text-gray-700 dark:hover:text-white"
            title="Copier le code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {(language === "python" || !language) && (
            <button
              onClick={() => void runInQgis()}
              className="flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-600/20 px-2.5 py-1 text-xs font-semibold text-blue-400 transition-all hover:bg-blue-600/30"
              title="Exécuter dans QGIS"
            >
              <Sparkles size={12} />
              <span>EXÉCUTER</span>
            </button>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language || "python"}
        style={isDark ? vscDarkPlus : vs}
        customStyle={{
          margin: 0,
          padding: "1.2rem",
          fontSize: "0.85rem",
          backgroundColor: isDark ? "#0d0d0d" : "#f8f8f8",
          lineHeight: "1.6",
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
