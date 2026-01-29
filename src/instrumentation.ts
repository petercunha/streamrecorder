// Next.js Instrumentation API
// This runs when the Next.js server starts in production
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

// Default check interval (60 seconds)
const CHECK_INTERVAL_MS = 60000;

export async function register() {
  // Only run on the server, not during static generation
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic imports to avoid Edge Runtime bundling issues
    const { initDatabase } = await import('./lib/db');
    const { default: recordingService } = await import('./lib/services/recording-service');
    const { RecordingModel, StatsModel } = await import('./lib/models');
    
    // Initialize database
    initDatabase();
    
    console.log('[Instrumentation] Initializing server...');
    
    // Clean up any orphaned recordings from previous unclean shutdown
    await cleanupOrphanedRecordings(RecordingModel, StatsModel);
    
    // Start the auto-recording service
    recordingService.startAutoChecker(CHECK_INTERVAL_MS);
    
    // Do an initial check immediately
    recordingService.checkAndRecordStreamers();
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(recordingService);
    
    console.log('[Instrumentation] Server initialization complete');
  }
}

// Clean up recordings that were left in 'recording' status from a previous unclean shutdown
async function cleanupOrphanedRecordings(
  RecordingModel: typeof import('./lib/models').RecordingModel,
  StatsModel: typeof import('./lib/models').StatsModel
): Promise<void> {
  try {
    // Find all recordings with 'recording' status
    const activeRecordings = RecordingModel.findAll({ status: 'recording' });
    
    if (activeRecordings.length > 0) {
      console.log(`[Cleanup] Found ${activeRecordings.length} orphaned recording(s) from previous session`);
      
      const endTime = new Date();
      
      for (const recording of activeRecordings) {
        // Calculate duration based on started_at time
        const startedAt = new Date(recording.started_at);
        const durationSeconds = Math.floor((endTime.getTime() - startedAt.getTime()) / 1000);
        
        // Update to 'stopped' status (since we don't know if it completed successfully)
        RecordingModel.update(recording.id, {
          status: 'stopped',
          ended_at: endTime.toISOString(),
          duration_seconds: durationSeconds,
        });
        
        console.log(`[Cleanup] Updated orphaned recording ${recording.id} (${recording.streamer_username}) to 'stopped' status`);
      }
      
      // Reset stats
      StatsModel.update({ active_recordings: 0 });
      
      console.log(`[Cleanup] ${activeRecordings.length} orphaned recording(s) cleaned up`);
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up orphaned recordings:', error);
  }
}

function setupGracefulShutdown(
  recordingService: typeof import('./lib/services/recording-service').default
): void {
  // Track if shutdown is in progress to prevent multiple calls
  let isShuttingDown = false;
  
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] ${signal} received again, already shutting down...`);
      return;
    }
    
    isShuttingDown = true;
    console.log(`\n[Shutdown] ${signal} received. Starting graceful shutdown...`);
    
    try {
      // Stop all active recordings and update database
      await recordingService.shutdown();
      
      console.log('[Shutdown] Graceful shutdown complete');
    } catch (error) {
      console.error('[Shutdown] Error during shutdown:', error);
    }
    
    // Give a small delay for logs to flush, then exit
    setTimeout(() => {
      // Use global process object
      (globalThis as typeof globalThis & { process: typeof process }).process.exit(0);
    }, 100);
  };

  // Use global process object to avoid Edge Runtime bundling warnings
  const globalProcess = (globalThis as typeof globalThis & { process: typeof process }).process;
  
  // Listen for shutdown signals
  globalProcess.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  globalProcess.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  globalProcess.on('uncaughtException', (error: Error) => {
    console.error('[Shutdown] Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  globalProcess.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[Shutdown] Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
  
  // Handle exit event as last resort (synchronous, no async allowed)
  globalProcess.on('exit', (code: number) => {
    console.log(`[Shutdown] Process exiting with code ${code}`);
  });
  
  // Handle Ctrl+C in Windows
  if (globalProcess.platform === 'win32') {
    globalProcess.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
  }
  
  console.log('[Instrumentation] Graceful shutdown handlers registered');
}
