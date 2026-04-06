import { FileText, X, Upload } from "lucide-react";
import { useDocumentStore } from "../stores/useDocumentStore";
import { extractTextFromFile, formatFileSize, getFileIcon } from "../lib/document-utils";

interface DocumentUploaderProps {
  onDocumentsChange?: (documents: Array<{ id: string; content: string; name: string }>) => void;
}

export default function DocumentUploader({ onDocumentsChange }: DocumentUploaderProps) {
  const documents = useDocumentStore((s) => s.documents);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const removeDocument = useDocumentStore((s) => s.removeDocument);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      try {
        const content = await extractTextFromFile(file);
        addDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          content,
        });
      } catch (error) {
        console.error("Error extracting text from file:", error);
        alert(`Erreur lors de l'extraction du texte de ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Reset input
    e.target.value = "";
    
    // Notify parent component
    if (onDocumentsChange) {
      const allDocs = documents.map((d) => ({ id: d.id, content: d.content, name: d.name }));
      onDocumentsChange(allDocs);
    }
  };

  const handleRemove = (id: string) => {
    removeDocument(id);
    if (onDocumentsChange) {
      const allDocs = documents.filter((d) => d.id !== id).map((d) => ({ id: d.id, content: d.content, name: d.name }));
      onDocumentsChange(allDocs);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.05] hover:text-white cursor-pointer">
          <Upload size={14} />
          <span>Joindre un fichier</span>
          <input
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.xml,.js,.py,.ts,.tsx,.jsx,.sql,.sh"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <span className="text-[10px] text-white/35">
          TXT, MD, CSV, JSON, XML, code files
        </span>
      </div>
      
      {documents.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
            >
              <span className="text-sm">{getFileIcon(doc.name)}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-white/70">
                {doc.name}
              </span>
              <span className="text-[10px] text-white/40">
                {formatFileSize(doc.size)}
              </span>
              <button
                onClick={() => handleRemove(doc.id)}
                className="rounded-md border border-white/10 bg-white/5 p-1 text-white/40 transition-all hover:bg-white/10 hover:text-white/60"
                title="Supprimer"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
