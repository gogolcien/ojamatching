// Utilidades compartidas para generar PDFs desde HTML (expo-print) y
// compartirlos/guardarlos (expo-sharing). Sin acceso a red.
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

// Evita que nombres de jugadores con caracteres especiales rompan el HTML.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatTimeNow() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Genera 6 dígitos al azar (como string) para nombres de archivo únicos.
export function randomDigits(count = 6) {
  let s = "";
  for (let i = 0; i < count; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// Convierte un texto libre en un nombre de archivo válido (sin
// caracteres prohibidos por el sistema de archivos).
function sanitizeFileName(name) {
  const clean = String(name || "documento")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "documento";
}

// Genera el PDF a partir de HTML y lo comparte (o lo descarga en web).
// fileBaseName: nombre deseado para el archivo, sin extensión.
export async function exportPdf(html, fileBaseName = "documento") {
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (Platform.OS === "web") {
    // En web, printToFileAsync ya abre el diálogo de impresión/descarga,
    // donde el usuario puede elegir el nombre del archivo.
    return;
  }

  let finalUri = uri;
  try {
    const safeName = `${sanitizeFileName(fileBaseName)}.pdf`;
    const source = new File(uri);
    const dest = new File(Paths.cache, safeName);
    if (dest.exists) dest.delete();
    source.copy(dest);
    finalUri = dest.uri;
  } catch (e) {
    // Si el renombrado falla por algún motivo, se comparte igual el
    // archivo con el nombre autogenerado por expo-print.
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(finalUri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" });
  }
}

// Estilos base reutilizados por los distintos PDFs de la app.
export function pdfBaseStyles() {
  return `
    <style>
      @page { margin: 28px; }
      * { box-sizing: border-box; }
      body { font-family: Helvetica, Arial, sans-serif; color: #1b1b1b; margin: 0; }
      h1 { font-size: 19px; margin: 0 0 6px; }
      .meta { font-size: 11px; color: #555; margin-bottom: 18px; }
      .meta span { margin-right: 18px; }
      table { width: 100%; border-collapse: collapse; }
      thead th {
        text-align: left;
        font-size: 9.5px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #666;
        border-bottom: 1.5px solid #bbb;
        padding: 6px 8px;
      }
      tbody td { font-size: 12px; padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
      tbody tr:nth-child(even) { background: #f7f7f7; }
    </style>
  `;
}
