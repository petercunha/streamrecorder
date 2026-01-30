import { vi } from 'vitest';
import { EventEmitter } from 'events';

export interface MockStreamlinkOptions {
  isLive?: boolean;
  title?: string;
  category?: string;
  error?: string;
  timeout?: boolean;
  invalidJson?: boolean;
  exitCode?: number | null;
  delayMs?: number;
}

/**
 * Creates a mock child process that simulates streamlink behavior
 */
export function createMockChildProcess(options: MockStreamlinkOptions = {}): EventEmitter {
  const {
    isLive = true,
    title = 'Test Stream',
    category = 'Just Chatting',
    error,
    timeout = false,
    invalidJson = false,
    exitCode = 0,
    delayMs = 10,
  } = options;

  const mockProcess = new EventEmitter() as EventEmitter & {
    killed: boolean;
    kill: (signal?: string) => boolean;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  mockProcess.killed = false;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  mockProcess.kill = vi.fn((signal?: string) => {
    mockProcess.killed = true;
    
    // Simulate process termination
    setTimeout(() => {
      mockProcess.emit('close', signal === 'SIGKILL' ? 1 : exitCode);
    }, delayMs);
    
    return true;
  });

  // Simulate streamlink output
  if (!timeout) {
    setTimeout(() => {
      if (mockProcess.killed) return;

      let output: string;
      
      if (invalidJson) {
        output = 'invalid json {';
      } else if (error) {
        output = JSON.stringify({ error });
      } else if (isLive) {
        output = JSON.stringify({
          metadata: { title, category },
          type: 'hls',
          url: 'https://test-stream.example/stream.m3u8',
        });
      } else {
        output = JSON.stringify({ error: 'No playable streams found' });
      }

      mockProcess.stdout.emit('data', Buffer.from(output));
      
      setTimeout(() => {
        if (!mockProcess.killed) {
          mockProcess.emit('close', exitCode);
        }
      }, delayMs);
    }, delayMs);
  }

  return mockProcess;
}

/**
 * Mock child_process.spawn for streamlink tests
 */
export function mockSpawn(options: MockStreamlinkOptions | MockStreamlinkOptions[] = {}): void {
  let callCount = 0;
  
  vi.mock('child_process', () => ({
    spawn: vi.fn((command: string, args: string[]) => {
      const opts = Array.isArray(options) ? options[callCount++] || {} : options;
      
      if (command === 'streamlink') {
        return createMockChildProcess(opts);
      }
      
      // Default mock for other commands
      const defaultProcess = new EventEmitter() as EventEmitter & {
        killed: boolean;
        kill: () => boolean;
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      defaultProcess.killed = false;
      defaultProcess.stdout = new EventEmitter();
      defaultProcess.stderr = new EventEmitter();
      defaultProcess.kill = vi.fn(() => {
        defaultProcess.killed = true;
        return true;
      });
      return defaultProcess;
    }),
  }));
}

/**
 * Setup mock for streamlink with different responses per call
 */
export function setupStreamlinkMock(responses: MockStreamlinkOptions[]): void {
  mockSpawn(responses);
}
