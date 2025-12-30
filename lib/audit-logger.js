/**
 * Audit Logger Service
 * 
 * Creates immutable audit logs for all security-critical events.
 * All logs use server timestamps to prevent client manipulation.
 */

import AuditLog from '../models/AuditLog.js';
import connectDB from './mongodb.js';
import { getClientIP } from './device-fingerprint.js';

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {String} params.attemptId - Attempt ID
 * @param {String} params.userId - User ID
 * @param {String} params.olympiadId - Olympiad ID
 * @param {String} params.eventType - Event type (e.g., 'start', 'answer', 'skip', 'tab_switch')
 * @param {Object} params.metadata - Additional metadata
 * @param {Object} params.req - Request object (optional, for IP and user agent)
 * @returns {Promise<Object>} - Created audit log
 */
export async function createAuditLog({
  attemptId,
  userId,
  olympiadId,
  eventType,
  metadata = {},
  req = null
}) {
  try {
    await connectDB();
    
    const auditLog = new AuditLog({
      attemptId,
      userId,
      olympiadId,
      eventType,
      timestamp: new Date(), // Server timestamp - never trust client
      metadata,
      ipAddress: req ? getClientIP(req) : null,
      userAgent: req?.headers?.['user-agent'] || null,
      deviceFingerprint: metadata.deviceFingerprint || null
    });
    
    await auditLog.save();
    
    return auditLog.toObject();
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging failures shouldn't break the main flow
    // but log the error for monitoring
    return null;
  }
}

/**
 * Get audit logs for an attempt
 * @param {String} attemptId - Attempt ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of audit logs
 */
export async function getAuditLogs(attemptId, options = {}) {
  try {
    await connectDB();
    
    const {
      limit = 100,
      skip = 0,
      eventType = null,
      startDate = null,
      endDate = null
    } = options;
    
    const query = { attemptId };
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    
    return logs;
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
}

/**
 * Get audit logs for an olympiad
 * @param {String} olympiadId - Olympiad ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of audit logs
 */
export async function getOlympiadAuditLogs(olympiadId, options = {}) {
  try {
    await connectDB();
    
    const {
      limit = 100,
      skip = 0,
      eventType = null,
      userId = null
    } = options;
    
    const query = { olympiadId };
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    
    return logs;
  } catch (error) {
    console.error('Error getting olympiad audit logs:', error);
    throw error;
  }
}

/**
 * Get audit log statistics for an attempt
 * @param {String} attemptId - Attempt ID
 * @returns {Promise<Object>} - Statistics object
 */
export async function getAuditLogStatistics(attemptId) {
  try {
    await connectDB();
    
    const logs = await AuditLog.find({ attemptId }).lean();
    
    const stats = {
      totalEvents: logs.length,
      eventTypes: {},
      violations: 0,
      disconnects: 0,
      tabSwitches: 0,
      timeRange: {
        start: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        end: logs.length > 0 ? logs[0].timestamp : null
      }
    };
    
    logs.forEach(log => {
      // Count event types
      stats.eventTypes[log.eventType] = (stats.eventTypes[log.eventType] || 0) + 1;
      
      // Count specific events
      if (log.eventType === 'violation' || log.eventType.includes('violation')) {
        stats.violations++;
      }
      if (log.eventType === 'disconnect') {
        stats.disconnects++;
      }
      if (log.eventType === 'tab_switch' || log.eventType === 'window_blur') {
        stats.tabSwitches++;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting audit log statistics:', error);
    throw error;
  }
}
