export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  // Text files
  if (
    fileType === "text/plain" ||
    fileType === "text/markdown" ||
    fileType === "text/csv" ||
    fileType === "application/json" ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".json") ||
    fileName.endsWith(".xml")
  ) {
    return await file.text();
  }
  
  // Code files
  if (
    fileType === "text/javascript" ||
    fileType === "text/x-python" ||
    fileType === "text/x-java" ||
    fileType === "text/x-csrc" ||
    fileType === "text/x-c++src" ||
    fileName.endsWith(".js") ||
    fileName.endsWith(".py") ||
    fileName.endsWith(".java") ||
    fileName.endsWith(".c") ||
    fileName.endsWith(".cpp") ||
    fileName.endsWith(".h") ||
    fileName.endsWith(".ts") ||
    fileName.endsWith(".tsx") ||
    fileName.endsWith(".jsx") ||
    fileName.endsWith(".sql") ||
    fileName.endsWith(".sh") ||
    fileName.endsWith(".bat") ||
    fileName.endsWith(".ps1")
  ) {
    return await file.text();
  }
  
  // For binary files (PDF, DOCX, images), we'll return a placeholder
  // In a real implementation, you would use libraries like pdf.js, mammoth.js, etc.
  throw new Error(
    `Type de fichier non supporté pour l'extraction de texte: ${fileType}. Types supportés: TXT, MD, CSV, JSON, XML, et fichiers de code.`,
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  const iconMap: Record<string, string> = {
    txt: "📄",
    md: "📝",
    pdf: "📕",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    csv: "📊",
    json: "📋",
    xml: "📋",
    py: "🐍",
    js: "📜",
    ts: "📘",
    sql: "🗃️",
    sh: "⚙️",
  };
  
  return iconMap[ext] || "📄";
}
