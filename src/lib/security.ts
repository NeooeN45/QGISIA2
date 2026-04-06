/**
 * Security utilities for GeoSylva AI
 * Ensures sensitive data is protected and not exposed
 */

/**
 * Sanitizes data before sending to LLM
 * Removes sensitive information like API keys, passwords, tokens
 */
export function sanitizeForLLM(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = ['apiKey', 'api_key', 'password', 'token', 'secret', 'auth', 'credential'];
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLLM(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Strips API keys from URLs
 */
export function stripApiKeyFromUrl(url: string): string {
  return url.replace(/([?&](api_key|apikey|key|token)[=][^&]*)/gi, '$1=[REDACTED]');
}

/**
 * Safe console.log that doesn't log sensitive data
 */
export function safeLog(...args: any[]) {
  console.log(...args); // Direct console.log for debugging
  const sanitized = args.map(arg => {
    if (typeof arg === 'string') {
      // Check for API keys in strings
      return arg.replace(/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY]')
               .replace(/Bearer [a-zA-Z0-9]{32,}/g, 'Bearer [TOKEN]')
               .replace(/password["\s:=]+[^\s"']+/gi, 'password=[REDACTED]');
    }
    if (typeof arg === 'object') {
      return sanitizeForLLM(arg);
    }
    return arg;
  });
  console.log("[SANITIZED]", ...sanitized);
}

/**
 * Validates that a request is to an allowed endpoint
 */
const ALLOWED_ENDPOINTS = [
  'localhost',
  '127.0.0.1',
  'geo.api.gouv.fr',
  'wxs.ign.fr',
  'overpass-api.de',
  'scihub.copernicus.eu',
  'earthsearch.nasa.gov',
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
];

export function isAllowedEndpoint(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_ENDPOINTS.some(allowed => hostname.includes(allowed));
  } catch {
    return false;
  }
}

/**
 * Rate limiter to prevent abuse
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove requests outside the time window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Content Security Policy headers
 */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: http://localhost:* ws://localhost:* wss://localhost:*;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
