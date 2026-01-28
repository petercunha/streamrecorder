// Server-side initialization
// This module handles one-time initialization when the Next.js app starts

import { autoRecordingService } from './services/auto-recording-service';
import recordingService from './services/recording-service';

let initialized = false;

export function initServer(): void {
  if (initialized) {
    return;
  }

  console.log('Initializing server...');
  
  // Start the auto-recording background service
  // This performs an initial check immediately and then periodic checks
  autoRecordingService.start();
  
  // Setup graceful shutdown handlers
  setupGracefulShutdown();
  
  initialized = true;
  console.log('Server initialization complete');
}

function setupGracefulShutdown(): void {
  // Handle graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    try {
      // Stop the auto-recording service
      autoRecordingService.stop();
      
      // Stop all active recordings
      await recordingService.shutdown();
      
      console.log('Graceful shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
    
    // Exit the process
    process.exit(0);
  };

  // Listen for shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
  
  // Handle exit event as last resort
  process.on('exit', (code) => {
    console.log(`Process exiting with code ${code}`);
  });
}

// Auto-initialize when imported in Next.js (will only run server-side)
initServer();
