/**
 * Utilitaires de chiffrement simple pour les clés API
 * Utilise une implémentation basique de chiffrement XOR avec une clé dérivée
 * Note: Ceci est une protection basique contre l'accès accidentel, pas contre une attaque ciblée
 */

// Clé de chiffrement dérivée d'une chaîne fixe (en production, utiliser une clé propre à l'utilisateur)
const ENCRYPTION_KEY = "GeoAI-QGIS-2024-Encryption-Key";

/**
 * Encode une chaîne UTF-8 en base64 (compatible avec tous les caractères)
 */
function utf8ToBase64(str: string): string {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    const binaryString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binaryString);
  } catch {
    return "";
  }
}

/**
 * Décode une chaîne base64 en UTF-8
 */
function base64ToUtf8(base64: string): string {
  try {
    const binaryString = atob(base64);
    const utf8Bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      utf8Bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(utf8Bytes);
  } catch {
    return "";
  }
}

/**
 * Chiffre une chaîne avec XOR (compatible UTF-8)
 */
function xorEncrypt(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  // Encoder en base64 via UTF-8 pour supporter tous les caractères
  return utf8ToBase64(result);
}

/**
 * Déchiffre une chaîne XOR (compatible UTF-8) avec fallback ancien format
 */
function xorDecrypt(encrypted: string, key: string): string {
  try {
    // Essayer d'abord le nouveau format UTF-8
    const decoded = base64ToUtf8(encrypted);
    if (decoded) {
      let result = "";
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(
          decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      // Vérifier si le résultat semble valide (pas de caractères de contrôle bizarres)
      if (result && !/[\x00-\x08\x0b-\x0c\x0e-\x1f]/.test(result)) {
        return result;
      }
    }
    
    // Fallback: ancien format avec atob direct (pour compatibilité)
    try {
      const legacyDecoded = atob(encrypted);
      let result = "";
      for (let i = 0; i < legacyDecoded.length; i++) {
        result += String.fromCharCode(
          legacyDecoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch {
      return "";
    }
  } catch {
    return "";
  }
}

/**
 * Chiffre une clé API pour le stockage
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return "";
  try {
    return xorEncrypt(apiKey, ENCRYPTION_KEY);
  } catch {
    return apiKey; // Fallback en cas d'erreur
  }
}

/**
 * Déchiffre une clé API depuis le stockage
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return "";
  try {
    return xorDecrypt(encryptedApiKey, ENCRYPTION_KEY);
  } catch {
    return encryptedApiKey; // Fallback si ce n'est pas chiffré
  }
}

/**
 * Masque une clé API pour l'affichage
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return "•".repeat(apiKey.length || 8);
  }
  return `${apiKey.slice(0, 4)}${"•".repeat(Math.max(apiKey.length - 8, 4))}${apiKey.slice(-4)}`;
}
