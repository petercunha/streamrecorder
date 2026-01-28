// Server-side initialization
// This module handles one-time initialization when the Next.js app starts

import { autoRecordingService } from './services/auto-recording-service';

let initialized = false;

export function initServer(): void {
  if (initialized) {
    return;
  }

  console.log('Initializing server...');
  
  // Start the auto-recording background service
  autoRecordingService.start();
  
  initialized = true;
  console.log('Server initialization complete');
}

// Auto-initialize when imported in Next.js (will only run server-side)
initServer();
