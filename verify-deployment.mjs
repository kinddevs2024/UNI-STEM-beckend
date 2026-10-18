import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { io } from 'socket.io-client';
import User from './models/User.js';

dotenv.config();
const base = process.env.VERIFY_BASE || 'https://www.global-olimpiads.biz';
const email = `deployment-${crypto.randomBytes(8).toString('hex')}@example.com`;
const password = crypto.randomBytes(32).toString('hex');
let created;
const attemptId = new mongoose.Types.ObjectId();
async function request(path, method = 'GET', body, token) {
  const result = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) },
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(20000),
  });
  return { status: result.status, data: await result.json() };
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.checks.db, 'connected');
  console.log('PASS HTTPS API and database health');

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: false, requireTLS: true,
    auth: {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS},
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
  });
  await transport.verify();
  transport.close();
  console.log('PASS Gmail SMTP authentication and STARTTLS (no message sent)');

  const forbiddenRole = await request('/auth/register', 'POST', {name: 'Deployment check', email, password, role: 'owner'});
  assert.equal(forbiddenRole.status, 400);
  assert.equal(await User.countDocuments({email}), 0);
  console.log('PASS public registration cannot create an owner');

  created = await User.create({name: 'Deployment check', email, passwordHash: await bcrypt.hash(password, 10), role: 'student', emailVerified: true});
  const login = await request('/auth/login', 'POST', {email, password});
  assert.equal(login.status, 200);
  assert.ok(login.data.token);
  const token = login.data.token;
  const update = await request('/auth/profile', 'PUT', {name: 'Deployment profile check', schoolName: 'Test school', schoolId: 'QA'}, token);
  assert.equal(update.status, 200);
  assert.equal(update.data.user.name, 'Deployment profile check');
  assert.equal('passwordHash' in update.data.user, false);
  const me = await request('/auth/me', 'GET', undefined, token);
  assert.equal(me.status, 200);
  assert.equal(me.data.schoolId, 'QA');
  assert.equal('passwordHash' in me.data, false);
  assert.equal((await User.findById(created._id)).name, 'Deployment profile check');
  assert.equal((await request('/olympiads', 'GET', undefined, token)).status, 200);
  console.log('PASS login, authenticated catalog, profile save and database persistence');

  assert.equal((await request('/auth/google', 'POST', {token: 'invalid-deployment-test-token'})).status, 401);
  console.log('PASS Google endpoint rejects invalid token');

  await new Promise((resolve, reject) => {
    const socket = io(base, {transports: ['websocket'], auth: {token}, reconnection: false});
    const timeout = setTimeout(() => {socket.disconnect(); reject(new Error('WebSocket timeout'));}, 10000);
    socket.on('connect_error', () => {clearTimeout(timeout); socket.disconnect(); reject(new Error('WebSocket connection failed'));});
    socket.on('connect', () => {
      socket.emit('join-olympiad', {olympiadId: attemptId.toString(), attemptId: attemptId.toString()});
      socket.emit('heartbeat', {attemptId: attemptId.toString()});
    });
    socket.once('heartbeat-ack', () => {
      clearTimeout(timeout);
      socket.emit('leave-olympiad', attemptId.toString());
      socket.disconnect();
      resolve();
    });
  });
  console.log('PASS authenticated WebSocket over TLS and heartbeat acknowledgment');
} catch (error) {
  console.error('FAIL deployment verification:', error.code || error.name, error.message?.replace(/mongodb[^\s]+/g, '[redacted]'));
  process.exitCode = 1;
} finally {
  if (created) await User.deleteOne({_id: created._id, email});
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.collection('sessionheartbeats').deleteMany({attemptId});
  }
  await mongoose.disconnect();
  console.log('Temporary test data cleaned up.');
}
