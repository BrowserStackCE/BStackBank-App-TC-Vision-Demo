/**
 * App-wide logger — Fix 15
 * In development: logs to console as normal.
 * In production: all logs are silenced (no PII leaks to log aggregators).
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('message');
 *   logger.warn('warning');
 *   logger.error('error');
 */

const noop = () => {};

export const logger = {
  log: __DEV__ ? console.log.bind(console) : noop,
  warn: __DEV__ ? console.warn.bind(console) : noop,
  error: __DEV__ ? console.error.bind(console) : noop,
  info: __DEV__ ? console.info.bind(console) : noop,
};
