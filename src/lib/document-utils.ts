import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import mammoth from "mammoth";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

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
  
  // PDF Extraction
  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str)
          .join(" ");
        fullText += `[Page ${i}]\n${pageText}\n\n`;
      }
      return fullText.trim();
    } catch (error) {
      console.error("PDF Extraction error:", error);
      throw new Error(`Erreur lors de la lecture du PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // DOCX Extraction (Word)
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
    fileName.endsWith(".docx")
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("DOCX Extraction error:", error);
      throw new Error("Erreur lors de la lecture du fichier Word DOCX.");
    }
  }

  // XLSX Extraction (Excel) - Basic XML extraction since we don't want a heavy dependency like sheetjs just for text
  if (
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
    fileName.endsWith(".xlsx")
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Try to find shared strings which contain most of the text in XLSX
      const sharedStringsFile = zip.file("xl/sharedStrings.xml");
      if (!sharedStringsFile) {
        return "[Fichier Excel détecté mais aucune chaîne de texte partagée trouvée]";
      }
      
      const xmlData = await sharedStringsFile.async("string");
      // Extract everything between <t> and </t> tags
      const regex = /<t[^>]*>(.*?)<\/t>/g;
      let match;
      const strings: string[] = [];
      
      while ((match = regex.exec(xmlData)) !== null) {
        // Unescape XML entities
        const text = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        if (text.trim()) strings.push(text);
      }
      
      return `[Contenu extrait du classeur Excel]\n${strings.join(" | ")}`;
    } catch (error) {
      console.error("XLSX Extraction error:", error);
      throw new Error("Erreur lors de la lecture du fichier Excel XLSX.");
    }
  }

  // Images (Pas de Tesseract/OCR local pour le moment, on prévient l'utilisateur)
  if (fileType.startsWith("image/") || fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    throw new Error("L'analyse des images (OCR) n'est pas encore supportée en mode hors-ligne. Veuillez convertir l'image en texte.");
  }

  throw new Error(
    `Type de fichier non supporté: ${fileType || fileName}. Types supportés: PDF, DOCX, XLSX, TXT, MD, CSV, JSON et fichiers de code.`,
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
