/**
 * Frontend Logger Utility
 * Controls console output based on environment and log level
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 
  (import.meta.env.MODE === 'production' ? 'warn' : 'debug');

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

class Logger {
  private level: number;

  constructor(level: LogLevel = LOG_LEVEL) {
    this.level = LOG_LEVELS[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.level <= LOG_LEVELS[level];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  // Utility to group related logs
  group(label: string, callback: () => void): void {
    if (this.shouldLog('debug')) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }
}

export const logger = new Logger();

// Suppress RainbowKit/Coinbase telemetry errors in production
if (import.meta.env.MODE === 'production') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Filter out Coinbase analytics errors
    const message = args.join(' ');
    if (
      message.includes('cca-lite.coinbase.com') ||
      message.includes('Analytics SDK') ||
      message.includes('ERR_BLOCKED_BY_CLIENT')
    ) {
      return; // Suppress these errors
    }
    originalError.apply(console, args);
  };
}
