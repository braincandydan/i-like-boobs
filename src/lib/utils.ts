// Utility function to create URLs that work with the base path
export function createUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  
  // Remove leading slash from path if it exists
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Ensure base ends with slash and combine
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  
  return `${baseWithSlash}${cleanPath}`;
}

// For external URLs or absolute URLs, use this
export function isExternalUrl(url: string): boolean {
  return url.startsWith('http') || url.startsWith('//');
}
