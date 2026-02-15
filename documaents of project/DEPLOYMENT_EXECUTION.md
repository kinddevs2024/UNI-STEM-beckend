# 🚀 Production Deployment Execution Guide

**Status**: READY FOR EXECUTION  
**Last Updated**: December 2024  
**Version**: 1.0

This document provides **exact, copy-paste ready commands** for production deployment.

---

## 🚀 Deployment Commands

### Pre-Deployment: Environment Setup

```bash
# Generate JWT_SECRET (Linux/Mac)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"

# Generate JWT_SECRET (Windows PowerShell)
$JWT_SECRET = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "JWT_SECRET=$JWT_SECRET"

# Generate JWT_SECRET (Windows CMD - using Node.js)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Backend Deployment Commands

#### First Deploy

```bash
# Navigate to backend directory
cd UNI-STEM-beckend

# Create .env file (if not exists)
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/olympiad-platform?retryWrites=true&w=majority
JWT_SECRET=<paste-generated-secret-here>
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
FRONTEND_URL=https://yourdomain.com
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=104857600
EOF

# Set secure permissions (Linux/Mac)
chmod 600 .env

# Verify environment variables are loaded
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'MISSING'); console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'MISSING'); console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET')"

# Install production dependencies
npm install --production

# Create upload directories
mkdir -p uploads/olympiads uploads/users
chmod 755 uploads

# Test MongoDB connection
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { console.log('✅ MongoDB connected'); process.exit(0); }).catch(e => { console.error('❌ MongoDB connection failed:', e.message); process.exit(1); })"

# Start with PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "olympiad-backend" --env production
pm2 save
pm2 startup

# Verify PM2 process is running
pm2 status
pm2 logs olympiad-backend --lines 20
```

#### Redeploy (Updates)

```bash
cd UNI-STEM-beckend

# Stop current process
pm2 stop olympiad-backend

# Update dependencies (if package.json changed)
npm install --production

# Restart with PM2
pm2 restart olympiad-backend

# Verify restart
pm2 logs olympiad-backend --lines 20
```

### Frontend Deployment Commands

#### First Deploy

```bash
# Navigate to frontend directory
cd UNI-STEM-Front

# Create .env file (if not exists)
cat > .env << 'EOF'
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EOF

# For same-domain setup with reverse proxy:
# cat > .env << 'EOF'
# VITE_API_URL=/api
# VITE_SOCKET_URL=
# VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
# EOF

# Install dependencies
npm install

# Build for production
npm run build

# Verify build succeeded
ls -la dist/
test -f dist/index.html && echo "✅ Build successful" || echo "❌ Build failed"

# Deploy dist/ to web server
# Option A: Copy to Nginx/Apache directory
# cp -r dist/* /var/www/html/olympiad/

# Option B: Use hosting service (Vercel, Netlify, etc.)
# Follow hosting provider's deployment instructions
```

#### Redeploy (Updates)

```bash
cd UNI-STEM-Front

# Rebuild
npm install
npm run build

# Verify build
test -f dist/index.html && echo "✅ Build successful" || echo "❌ Build failed"

# Deploy new dist/ directory
# (Method depends on your hosting setup)
```

### Environment Variable Loading Examples

#### Backend (.env file location)

```bash
# Backend automatically loads .env from:
# 1. Current working directory: UNI-STEM-beckend/.env
# 2. Same directory as server.js
# 3. Parent directory

# Verify .env is loaded
cd UNI-STEM-beckend
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET ? '✅ .env loaded' : '❌ .env not loaded')"
```

#### Frontend (.env file location)

```bash
# Frontend .env must be in: UNI-STEM-Front/.env
# Vite reads .env at build time (not runtime)

# Verify .env variables are in build
cd UNI-STEM-Front
npm run build
grep -r "VITE_API_URL" dist/ || echo "Variables are embedded in build"
```

### Production-Safe Start Modes

#### Backend: PM2 (Recommended)

```bash
# Start with PM2
pm2 start server.js --name "olympiad-backend" --env production

# PM2 provides:
# - Automatic restarts on crash
# - Log management
# - Process monitoring
# - Zero-downtime restarts (with pm2 reload)

# Zero-downtime restart
pm2 reload olympiad-backend

# View logs
pm2 logs olympiad-backend

# Monitor resources
pm2 monit
```

#### Backend: Systemd (Alternative)

```bash
# Create systemd service file: /etc/systemd/system/olympiad-backend.service
sudo tee /etc/systemd/system/olympiad-backend.service > /dev/null << 'EOF'
[Unit]
Description=Global Olympiad Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/UNI-STEM-beckend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable olympiad-backend
sudo systemctl start olympiad-backend
sudo systemctl status olympiad-backend
```

#### Frontend: Nginx (Recommended)

```bash
# Nginx configuration (already documented in DEPLOYMENT_GUIDE.md)
# Frontend is static files - no process to manage
# Just serve dist/ directory via Nginx/Apache
```

---

## 🔁 Deployment Order

### Why This Order is Critical

1. **Database First**: Backend cannot start without database connection
2. **Backend Before Frontend**: Frontend depends on backend API
3. **Health Checks Between Steps**: Catch failures early before proceeding
4. **Frontend Last**: Only deploy frontend after backend is verified working

### Execution Sequence

#### Step 1: Database Readiness Check

```bash
# Test MongoDB connection from deployment server
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { console.log('✅ Database ready'); process.exit(0); }).catch(e => { console.error('❌ Database not ready:', e.message); process.exit(1); })"

# Expected: "✅ Database ready"
# Failure: Exit code 1, error message
# Action on failure: Fix MongoDB connection before proceeding
```

**Why**: Backend will fail to start if database is unavailable. Check first to avoid deployment failure.

---

#### Step 2: Backend Deploy

```bash
cd UNI-STEM-beckend

# Verify .env exists and has required variables
test -f .env || { echo "❌ .env file missing"; exit 1; }
node -e "require('dotenv').config(); if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) { console.error('❌ Missing required env vars'); process.exit(1); } else { console.log('✅ Environment variables OK'); }"

# Install dependencies
npm install --production

# Create upload directories
mkdir -p uploads/olympiads uploads/users

# Start backend
pm2 start server.js --name "olympiad-backend" --env production || pm2 restart olympiad-backend
pm2 save
```

**Why**: Backend must be running before frontend can make API calls. Deploy and verify backend health before proceeding.

---

#### Step 3: Backend Health Verification

```bash
# Wait for backend to start (max 30 seconds)
sleep 5

# Check PM2 status
pm2 status | grep olympiad-backend | grep -q "online" || { echo "❌ Backend not running"; exit 1; }

# Health check endpoint
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo "✅ Backend health check passed"
else
  echo "❌ Backend health check failed (HTTP $HEALTH_RESPONSE)"
  pm2 logs olympiad-backend --lines 50
  exit 1
fi

# Verify API response
curl -s http://localhost:3000/api/health | grep -q "ok" || { echo "❌ Backend health response invalid"; exit 1; }
```

**Expected Result**: HTTP 200, response contains `{"status":"ok"}`  
**Failure Signal**: Non-200 status, no response, or PM2 process not "online"  
**Action on Failure**: Check PM2 logs, verify MongoDB connection, check environment variables

**Why**: Confirms backend is fully operational before frontend deployment. Catches configuration errors early.

---

#### Step 4: Frontend Deploy

```bash
cd UNI-STEM-Front

# Verify .env exists
test -f .env || { echo "❌ Frontend .env missing"; exit 1; }

# Build frontend
npm install
npm run build

# Verify build output
test -f dist/index.html || { echo "❌ Build failed - index.html missing"; exit 1; }
test -d dist/assets || { echo "❌ Build failed - assets directory missing"; exit 1; }

# Deploy to web server (example: Nginx)
# cp -r dist/* /var/www/html/olympiad/
# OR use your hosting provider's deployment method
```

**Why**: Frontend depends on backend API. Only deploy after backend is verified working.

---

#### Step 5: End-to-End Smoke Test

```bash
# Test frontend loads
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
  echo "✅ Frontend loads"
else
  echo "❌ Frontend failed (HTTP $FRONTEND_RESPONSE)"
  exit 1
fi

# Test API connectivity from frontend
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/api/health)
if [ "$API_RESPONSE" = "200" ]; then
  echo "✅ API accessible from frontend"
else
  echo "❌ API not accessible (HTTP $API_RESPONSE)"
  exit 1
fi
```

**Expected Result**: Both frontend and API return HTTP 200  
**Failure Signal**: Non-200 status codes  
**Action on Failure**: Check reverse proxy configuration, verify backend is running, check CORS settings

**Why**: Confirms complete system is operational. Final verification before declaring deployment successful.

---

## ✅ Post-Deploy Verification Checklist

### API Health

- [ ] **What to check**: Backend health endpoint  
  **Command**: `curl https://api.yourdomain.com/api/health`  
  **Expected**: `{"status":"ok","message":"Server is running"}`  
  **Failure Signal**: Non-200 status, timeout, or error message

- [ ] **What to check**: PM2 process status  
  **Command**: `pm2 status olympiad-backend`  
  **Expected**: Status shows "online", uptime > 0  
  **Failure Signal**: Status "stopped", "errored", or "restarting"

- [ ] **What to check**: Backend logs (no errors)  
  **Command**: `pm2 logs olympiad-backend --lines 50 --err`  
  **Expected**: No error messages in last 50 lines  
  **Failure Signal**: Error stack traces, connection failures, or exceptions

---

### Auth Flow

- [ ] **What to check**: User registration endpoint  
  **Command**: `curl -X POST https://api.yourdomain.com/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'`  
  **Expected**: HTTP 201 or 200, response contains user data or success message  
  **Failure Signal**: HTTP 500, 400 with invalid error, or timeout

- [ ] **What to check**: User login endpoint  
  **Command**: `curl -X POST https://api.yourdomain.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!"}'`  
  **Expected**: HTTP 200, response contains `token` field  
  **Failure Signal**: HTTP 401 (wrong credentials OK), HTTP 500, or no token in response

- [ ] **What to check**: Protected endpoint (with token)  
  **Command**: `curl -H "Authorization: Bearer <token>" https://api.yourdomain.com/api/auth/me`  
  **Expected**: HTTP 200, response contains user data  
  **Failure Signal**: HTTP 401 (unauthorized), HTTP 500, or no user data

---

### Portfolio Public Access

- [ ] **What to check**: Public portfolio access (no auth)  
  **Command**: `curl https://yourdomain.com/portfolio/<public-slug>`  
  **Expected**: HTTP 200, portfolio content loads  
  **Failure Signal**: HTTP 404, 403, or 500 error

- [ ] **What to check**: Portfolio API endpoint (public)  
  **Command**: `curl https://api.yourdomain.com/api/portfolio/<portfolio-id>`  
  **Expected**: HTTP 200 (if public) or 403 (if private)  
  **Failure Signal**: HTTP 500 or unexpected status

---

### University Flow

- [ ] **What to check**: University dashboard access  
  **Command**: Login as university user, navigate to `/university-dashboard`  
  **Expected**: Dashboard loads, shows portfolio list  
  **Failure Signal**: 403 Forbidden, blank page, or error message

- [ ] **What to check**: Portfolio listing API (university)  
  **Command**: `curl -H "Authorization: Bearer <university-token>" "https://api.yourdomain.com/api/portfolios?page=1&limit=20"`  
  **Expected**: HTTP 200, response contains `data` array and `pagination` object  
  **Failure Signal**: HTTP 403, 500, or missing pagination data

- [ ] **What to check**: Contact masking (university)  
  **Command**: Check portfolio data in university dashboard  
  **Expected**: Email/phone are masked (e.g., `***@***.com`)  
  **Failure Signal**: Full contact information visible

---

### Pagination Verification

- [ ] **What to check**: Backend pagination response structure  
  **Command**: `curl -H "Authorization: Bearer <token>" "https://api.yourdomain.com/api/portfolios?page=1&limit=20"`  
  **Expected**: Response contains `pagination: { page: 1, limit: 20, total: <number>, pages: <number> }`  
  **Failure Signal**: Missing pagination object, incorrect values, or client-side pagination only

- [ ] **What to check**: Pagination page navigation  
  **Command**: Request page 2: `?page=2&limit=20`  
  **Expected**: Different results than page 1, `pagination.page` = 2  
  **Failure Signal**: Same results as page 1, or page number doesn't change

- [ ] **What to check**: Invalid pagination parameters  
  **Command**: `?page=abc&limit=-1`  
  **Expected**: HTTP 200, falls back to defaults (page=1, limit=20)  
  **Failure Signal**: HTTP 500 or crashes

---

### Search Verification

- [ ] **What to check**: Search query parameter  
  **Command**: `curl -H "Authorization: Bearer <token>" "https://api.yourdomain.com/api/portfolios?search=test&page=1&limit=20"`  
  **Expected**: HTTP 200, results filtered by search term  
  **Failure Signal**: HTTP 500, all results returned (no filtering), or empty results when matches exist

- [ ] **What to check**: Search with special characters  
  **Command**: `?search=test&special[]=value`  
  **Expected**: HTTP 200, graceful handling (no crash)  
  **Failure Signal**: HTTP 500 or server error

- [ ] **What to check**: Empty search  
  **Command**: `?search=&page=1&limit=20`  
  **Expected**: HTTP 200, returns all portfolios (or filtered by other params)  
  **Failure Signal**: HTTP 500 or no results

---

## ⛔ Rollback Plan

### Backend Rollback Steps

```bash
# Step 1: Stop current backend
pm2 stop olympiad-backend

# Step 2: Restore previous code version
cd UNI-STEM-beckend

# Option A: Git checkout previous commit
git log --oneline -10  # Find previous commit hash
git checkout <previous-commit-hash>

# Option B: Restore from backup
# cp -r /backup/backend-2024-12-01/* .

# Step 3: Restore previous .env (if changed)
# cp /backup/.env.backup .env

# Step 4: Reinstall dependencies (if package.json changed)
npm install --production

# Step 5: Restart backend
pm2 restart olympiad-backend

# Step 6: Verify rollback
sleep 5
curl -s http://localhost:3000/api/health | grep -q "ok" && echo "✅ Rollback successful" || echo "❌ Rollback failed"
pm2 logs olympiad-backend --lines 20
```

**Downtime**: ~2-5 minutes  
**Data Safety**: ✅ Safe - No database changes

---

### Frontend Rollback Steps

```bash
# Step 1: Navigate to frontend directory
cd UNI-STEM-Front

# Step 2: Restore previous code version
# Option A: Git checkout previous commit
git log --oneline -10  # Find previous commit hash
git checkout <previous-commit-hash>

# Option B: Restore from backup
# cp -r /backup/frontend-2024-12-01/* .

# Step 3: Restore previous .env (if changed)
# cp /backup/.env.frontend.backup .env

# Step 4: Rebuild
npm install
npm run build

# Step 5: Deploy previous build
# cp -r dist/* /var/www/html/olympiad/
# OR use hosting provider's rollback feature

# Step 6: Verify rollback
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com
# Expected: HTTP 200
```

**Downtime**: ~2-5 minutes  
**Data Safety**: ✅ Safe - No database changes

---

### Database Rollback WARNINGS

⚠️ **CRITICAL WARNING**: Database rollback causes **IRREVERSIBLE DATA LOSS**

**Only execute if**:
- Data corruption detected
- Critical bug caused data integrity issues
- Security breach requiring data reset

**Pre-Rollback Checklist**:
- [ ] All other rollback methods exhausted
- [ ] Data loss is acceptable
- [ ] Backup is verified and recent
- [ ] Team approval obtained
- [ ] Users notified (if applicable)

**Database Rollback Steps**:

```bash
# Step 1: STOP BACKEND FIRST
pm2 stop olympiad-backend

# Step 2: Verify backup exists and is valid
ls -lh /backup/mongodb-2024-12-01/
mongorestore --dry-run --uri="mongodb+srv://..." /backup/mongodb-2024-12-01/

# Step 3: BACKUP CURRENT STATE (in case rollback fails)
mongodump --uri="mongodb+srv://..." --out=/backup/mongodb-before-rollback-$(date +%Y%m%d-%H%M%S)

# Step 4: Restore from backup
mongorestore --uri="mongodb+srv://user:password@cluster.mongodb.net/olympiad-platform" /backup/mongodb-2024-12-01/

# Step 5: Verify restore
mongo "mongodb+srv://..." --eval "db.portfolios.countDocuments()"
# Compare count with expected value

# Step 6: Restart backend
pm2 start olympiad-backend

# Step 7: Verify system works
sleep 5
curl -s http://localhost:3000/api/health | grep -q "ok" && echo "✅ Database rollback successful" || echo "❌ Rollback failed"
```

**Downtime**: ~10-30 minutes (depending on database size)  
**Data Loss**: ⚠️ **ALL DATA AFTER BACKUP DATE IS LOST**  
**Irreversible**: Yes - cannot undo data loss

---

## 📝 Quick Reference

### Health Check Commands

```bash
# Backend health
curl http://localhost:3000/api/health

# Frontend load
curl -I https://yourdomain.com

# PM2 status
pm2 status

# MongoDB connection
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected')).catch(e => console.error('❌', e))"
```

### Emergency Contacts

- **Backend Issues**: Check PM2 logs: `pm2 logs olympiad-backend`
- **Frontend Issues**: Check web server logs (Nginx: `/var/log/nginx/error.log`)
- **Database Issues**: Check MongoDB Atlas dashboard or local MongoDB logs

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: READY FOR PRODUCTION DEPLOYMENT

