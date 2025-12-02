// Client-side auth initialization
import { initAuth } from '../stores/auth';

// Initialize auth when this module loads
if (typeof window !== 'undefined') {
  initAuth();
}

