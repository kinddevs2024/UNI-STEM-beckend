#!/usr/bin/env node
/**
 * Ensure MongoDB indexes exist for Attempt, Submission, Olympiad, SessionHeartbeat.
 * Run once after deployment: node scripts/ensure-indexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/global-olympiad';

async function ensureIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    // Load models so their indexes are registered
    const Attempt = (await import('../models/Attempt.js')).default;
    const Submission = (await import('../models/Submission.js')).default;
    const Olympiad = (await import('../models/Olympiad.js')).default;
    const SessionHeartbeat = (await import('../models/SessionHeartbeat.js')).default;

    const models = [Attempt, Submission, Olympiad, SessionHeartbeat];
    for (const model of models) {
      if (model.syncIndexes) {
        console.log(`Syncing indexes for ${model.modelName}...`);
        await model.syncIndexes();
        console.log(`  ${model.modelName} indexes synced.`);
      }
    }

    console.log('Done. Indexes ensured.');
  } catch (error) {
    console.error('Error ensuring indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  }
}

ensureIndexes();
