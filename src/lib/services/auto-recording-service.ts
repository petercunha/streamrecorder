import recordingService from './recording-service';
import db from '@/lib/db';

// Service state management using database for persistence
function getServiceState(): { isRunning: boolean; startedAt: Date | null } {
  try {
    const row = db.prepare('SELECT is_running, started_at FROM service_state WHERE id = 1').get() as { is_running: number; started_at: string | null } | undefined;
    return {
      isRunning: row?.is_running === 1,
      startedAt: row?.started_at ? new Date(row.started_at) : null,
    };
  } catch (error) {
    console.error('Failed to get service state:', error);
    return { isRunning: false, startedAt: null };
  }
}

function setServiceState(isRunning: boolean): void {
  try {
    if (isRunning) {
      db.prepare(
        'UPDATE service_state SET is_running = 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
      ).run();
    } else {
      db.prepare(
        'UPDATE service_state SET is_running = 0, started_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
      ).run();
    }
  } catch (error) {
    console.error('Failed to set service state:', error);
  }
}

// Singleton to manage auto-recording background service
class AutoRecordingService {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number = 60000; // 1 minute default

  // Start the auto-recording background service
  start(): void {
    const state = getServiceState();
    if (state.isRunning) {
      console.log('Auto-recording service is already running');
      return;
    }

    console.log('Starting auto-recording background service...');
    
    // Update database state
    setServiceState(true);
    
    // Do an initial check immediately
    this.check();
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.check();
    }, this.intervalMs);

    console.log(`Auto-recording service running (interval: ${this.intervalMs}ms)`);
  }

  // Stop the service
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    // Update database state
    setServiceState(false);
    console.log('Auto-recording service stopped');
  }

  // Perform a check
  private async check(): Promise<void> {
    try {
      await recordingService.checkAndRecordStreamers();
    } catch (error) {
      console.error('Error during auto-recording check:', error);
    }
  }

  // Get service status
  getStatus(): { isRunning: boolean; intervalMs: number } {
    const state = getServiceState();
    return {
      isRunning: state.isRunning,
      intervalMs: this.intervalMs,
    };
  }
}

// Export singleton instance
export const autoRecordingService = new AutoRecordingService();
export default autoRecordingService;
