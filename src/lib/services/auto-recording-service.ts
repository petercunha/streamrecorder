import recordingService from './recording-service';

// Singleton to manage auto-recording background service
class AutoRecordingService {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number = 60000; // 1 minute default

  // Start the auto-recording background service
  start(): void {
    if (this.isRunning) {
      console.log('Auto-recording service is already running');
      return;
    }

    console.log('Starting auto-recording background service...');
    
    // Do an initial check immediately
    this.check();
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.check();
    }, this.intervalMs);

    this.isRunning = true;
    console.log(`Auto-recording service running (interval: ${this.intervalMs}ms)`);
  }

  // Stop the service
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
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
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
    };
  }
}

// Export singleton instance
export const autoRecordingService = new AutoRecordingService();
export default autoRecordingService;
