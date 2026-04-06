/**
 * Utilitaires de chiffrement simple pour les clés API
 * Utilise une implémentation basique de chiffrement XOR avec une clé dérivée
 * Note: Ceci est une protection basique contre l'accès accidentel, pas contre une attaque ciblée
 */

// Clé de chiffrement dérivée d'une chaîne fixe (en production, utiliser une clé propre à l'utilisateur)
const ENCRYPTION_KEY = "GeoAI-QGIS-2024-Encryption-Key";

/**
 * Chiffre une chaîne avec XOR
 */
function xorEncrypt(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  // Encoder en base64 pour le stockage
  return btoa(result);
}

/**
 * Déchiffre une chaîne XOR
 */
function xorDecrypt(encrypted: string, key: string): string {
  try {
    const decoded = atob(encrypted);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
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
