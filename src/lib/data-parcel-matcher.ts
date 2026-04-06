/**
 * Data-Parcel Matching System
 * 
 * Système de correspondance données/parcelles
 * Fait correspondre les données fournies par l'utilisateur avec les parcelles identifiées
 */

export interface UserProvidedData {
  parcelId?: string;
  parcelCode?: string;
  parcelName?: string;
  surface?: number;
  essence?: string;
  age?: number;
  volume?: number;
  ownership?: string;
  managementRegime?: string;
  customAttributes?: Record<string, any>;
}

export interface MatchResult {
  parcelId: string;
  parcelCode: string;
  parcelName: string;
  matchScore: number;
  matchReasons: string[];
  userData: UserProvidedData;
  parcelData: any;
  confidence: number;
}

export interface MatchingOptions {
  strictMatching: boolean;
  fuzzyThreshold: number;
  prioritizeId: boolean;
  prioritizeCode: boolean;
  prioritizeName: boolean;
}

/**
 * Système de correspondance données/parcelles
 */
export class DataParcelMatcher {
  /**
   * Fait correspondre les données utilisateur avec les parcelles
   */
  matchDataToParcels(
    userData: UserProvidedData,
    availableParcels: any[],
    options: Partial<MatchingOptions> = {}
  ): MatchResult[] {
    console.log(`🔗 Correspondance données/parcelles`);
    
    const matchingOptions: MatchingOptions = {
      strictMatching: false,
      fuzzyThreshold: 0.7,
      prioritizeId: true,
      prioritizeCode: true,
      prioritizeName: true,
      ...options,
    };
    
    const matches: MatchResult[] = [];
    
    for (const parcel of availableParcels) {
      const match = this.matchSingleParcel(userData, parcel, matchingOptions);
      if (match.matchScore > 0) {
        matches.push(match);
      }
    }
    
    // Trier par score de correspondance
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    console.log(`   ✅ ${matches.length} correspondance(s) trouvée(s)`);
    
    return matches;
  }
  
  /**
   * Fait correspondre les données avec une seule parcelle
   */
  private matchSingleParcel(
    userData: UserProvidedData,
    parcel: any,
    options: MatchingOptions
  ): MatchResult {
    let score = 0;
    const reasons: string[] = [];
    
    // Correspondance par ID
    if (userData.parcelId && parcel.id === userData.parcelId) {
      score += 100;
      reasons.push("ID exact");
    } else if (userData.parcelId && options.strictMatching) {
      return this.createNoMatch(userData, parcel);
    }
    
    // Correspondance par code
    if (userData.parcelCode && parcel.code === userData.parcelCode) {
      score += 80;
      reasons.push("Code exact");
    } else if (userData.parcelCode && parcel.code && this.fuzzyMatch(userData.parcelCode, parcel.code, options.fuzzyThreshold)) {
      score += 50;
      reasons.push("Code similaire");
    }
    
    // Correspondance par nom
    if (userData.parcelName && parcel.name === userData.parcelName) {
      score += 70;
      reasons.push("Nom exact");
    } else if (userData.parcelName && parcel.name && this.fuzzyMatch(userData.parcelName, parcel.name, options.fuzzyThreshold)) {
      score += 40;
      reasons.push("Nom similaire");
    }
    
    // Correspondance par surface
    if (userData.surface && parcel.surface) {
      const surfaceDiff = Math.abs(userData.surface - parcel.surface);
      const surfacePercentDiff = (surfaceDiff / userData.surface) * 100;
      
      if (surfacePercentDiff < 5) {
        score += 30;
        reasons.push("Surface très proche");
      } else if (surfacePercentDiff < 15) {
        score += 15;
        reasons.push("Surface proche");
      } else if (surfacePercentDiff > 50 && options.strictMatching) {
        score -= 20;
        reasons.push("Surface très différente");
      }
    }
    
    // Correspondance par essence
    if (userData.essence && parcel.essence) {
      if (userData.essence.toLowerCase() === parcel.essence.toLowerCase()) {
        score += 25;
        reasons.push("Essence identique");
      } else if (userData.essence.toLowerCase().includes(parcel.essence.toLowerCase()) ||
                 parcel.essence.toLowerCase().includes(userData.essence.toLowerCase())) {
        score += 15;
        reasons.push("Essence similaire");
      }
    }
    
    // Correspondance par âge
    if (userData.age && parcel.age) {
      const ageDiff = Math.abs(userData.age - parcel.age);
      
      if (ageDiff === 0) {
        score += 20;
        reasons.push("Âge identique");
      } else if (ageDiff <= 5) {
        score += 10;
        reasons.push("Âge proche");
      } else if (ageDiff > 20 && options.strictMatching) {
        score -= 10;
        reasons.push("Âge très différent");
      }
    }
    
    // Correspondance par volume
    if (userData.volume && parcel.volume) {
      const volumeDiff = Math.abs(userData.volume - parcel.volume);
      const volumePercentDiff = (volumeDiff / userData.volume) * 100;
      
      if (volumePercentDiff < 10) {
        score += 25;
        reasons.push("Volume très proche");
      } else if (volumePercentDiff < 25) {
        score += 15;
        reasons.push("Volume proche");
      }
    }
    
    // Correspondance par propriétaire
    if (userData.ownership && parcel.ownership) {
      if (userData.ownership.toLowerCase() === parcel.ownership.toLowerCase()) {
        score += 20;
        reasons.push("Propriétaire identique");
      } else if (userData.ownership.toLowerCase().includes(parcel.ownership.toLowerCase()) ||
                 parcel.ownership.toLowerCase().includes(userData.ownership.toLowerCase())) {
        score += 10;
        reasons.push("Propriétaire similaire");
      }
    }
    
    // Correspondance par régime de gestion
    if (userData.managementRegime && parcel.managementRegime) {
      if (userData.managementRegime.toLowerCase() === parcel.managementRegime.toLowerCase()) {
        score += 15;
        reasons.push("Régime identique");
      }
    }
    
    // Correspondance par attributs personnalisés
    if (userData.customAttributes) {
      for (const [key, value] of Object.entries(userData.customAttributes)) {
        if (parcel.attributes && parcel.attributes[key] === value) {
          score += 10;
          reasons.push(`Attribut ${key} identique`);
        }
      }
    }
    
    // Calculer la confiance
    const confidence = Math.min(score / 100, 1.0);
    
    return {
      parcelId: parcel.id,
      parcelCode: parcel.code || "",
      parcelName: parcel.name || "",
      matchScore: score,
      matchReasons: reasons,
      userData,
      parcelData: parcel,
      confidence,
    };
  }
  
  /**
   * Crée un résultat sans correspondance
   */
  private createNoMatch(userData: UserProvidedData, parcel: any): MatchResult {
    return {
      parcelId: parcel.id,
      parcelCode: parcel.code || "",
      parcelName: parcel.name || "",
      matchScore: 0,
      matchReasons: ["Aucune correspondance"],
      userData,
      parcelData: parcel,
      confidence: 0,
    };
  }
  
  /**
   * Correspondance floue
   */
  private fuzzyMatch(str1: string, str2: string, threshold: number): boolean {
    const lower1 = str1.toLowerCase();
    const lower2 = str2.toLowerCase();
    
    // Correspondance exacte
    if (lower1 === lower2) return true;
    
    // Correspondance partielle
    if (lower1.includes(lower2) || lower2.includes(lower1)) return true;
    
    // Similarité Levenshtein (simplifiée)
    const similarity = this.calculateSimilarity(lower1, lower2);
    return similarity >= threshold;
  }
  
  /**
   * Calcule la similarité entre deux chaînes
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    // Distance de Levenshtein simplifiée
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }
  
  /**
   * Distance de Levenshtein
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[len1][len2];
  }
  
  /**
   * Fait correspondre plusieurs données utilisateur avec les parcelles
   */
  matchMultipleDataToParcels(
    userDataList: UserProvidedData[],
    availableParcels: any[],
    options: Partial<MatchingOptions> = {}
  ): Map<UserProvidedData, MatchResult[]> {
    console.log(`🔗 Correspondance multiple données/parcelles: ${userDataList.length} données`);
    
    const matchesMap = new Map<UserProvidedData, MatchResult[]>();
    
    for (const userData of userDataList) {
      const matches = this.matchDataToParcels(userData, availableParcels, options);
      matchesMap.set(userData, matches);
    }
    
    console.log(`   ✅ ${matchesMap.size} correspondance(s) trouvée(s)`);
    
    return matchesMap;
  }
  
  /**
   * Trouve la meilleure correspondance
   */
  findBestMatch(userData: UserProvidedData, availableParcels: any[], options: Partial<MatchingOptions> = {}): MatchResult | null {
    const matches = this.matchDataToParcels(userData, availableParcels, options);
    
    if (matches.length === 0) {
      return null;
    }
    
    return matches[0];
  }
  
  /**
   * Vérifie si une correspondance est acceptable
   */
  isMatchAcceptable(match: MatchResult, minScore: number = 50, minConfidence: number = 0.5): boolean {
    return match.matchScore >= minScore && match.confidence >= minConfidence;
  }
}

/**
 * Helper pour créer un système de correspondance données/parcelles
 */
export function createDataParcelMatcher(): DataParcelMatcher {
  return new DataParcelMatcher();
}
