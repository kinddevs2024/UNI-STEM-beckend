# 🛡️ Post-Launch Stabilization Guide

**Status**: READY FOR POST-LAUNCH  
**Last Updated**: December 2024  
**Version**: 1.0

This document identifies observability gaps, hotfix safety zones, high-risk areas, and failure scenarios for the first 7-14 days after launch.

---

## 🔍 Observability Improvements

### Missing Logs (Backend)

**1. Request ID Tracking**
- **Location**: All API routes (`pages/api/**/*.js`)
- **Gap**: No request ID for tracing requests across logs
- **Impact**: Cannot correlate errors with specific user requests
- **Proposed**: Add request ID to console.error logs (minimal change)
- **Example**: `console.error('[REQ-12345] Login error:', error)`

**2. Authentication Flow Logging**
- **Location**: `pages/api/auth/login.js`, `pages/api/auth/register.js`
- **Gap**: No logging of failed login attempts (only errors logged)
- **Impact**: Cannot detect brute force attempts or patterns
- **Proposed**: Log failed attempts with email (no password): `console.log('Failed login attempt:', email)`

**3. Database Query Performance**
- **Location**: `pages/api/portfolios.js` (line 189-195), all portfolio endpoints
- **Gap**: No query timing logs
- **Impact**: Cannot detect slow queries until users complain
- **Proposed**: Log slow queries (>500ms): `console.warn('Slow query:', query, 'took', duration, 'ms')`

**4. File Upload Operations**
- **Location**: `pages/api/upload/*.js`, `pages/api/olympiads/upload-*.js`
- **Gap**: No logging of upload start/success/failure
- **Impact**: Silent failures if disk full or permissions wrong
- **Proposed**: Log upload attempts: `console.log('Upload started:', filename, 'size:', size)`

**5. Search Query Logging**
- **Location**: `pages/api/portfolios.js` (line 162-183)
- **Gap**: No logging of search terms or result counts
- **Impact**: Cannot detect problematic search patterns or performance issues
- **Proposed**: Log search queries: `console.log('Search query:', searchTerm, 'results:', count)`

**6. Pagination Parameter Validation**
- **Location**: `pages/api/portfolios.js` (line 112-114)
- **Gap**: No logging of invalid pagination parameters
- **Impact**: Cannot detect abuse (e.g., limit=10000)
- **Proposed**: Log unusual pagination: `if (limit > 100) console.warn('Large limit requested:', limit)`

### Missing Logs (Frontend)

**1. API Error Context**
- **Location**: `src/services/api.js` (response interceptor)
- **Gap**: Errors logged to console but no user-visible error tracking
- **Impact**: Users see generic errors, developers can't debug
- **Proposed**: Add error context to console.error: `console.error('[API Error]', method, url, status, error)`

**2. Failed API Calls**
- **Location**: All API calls in `src/services/api.js`
- **Gap**: No logging of failed requests (only caught in catch blocks)
- **Impact**: Silent failures in network issues
- **Proposed**: Log in interceptor: `console.error('[API Failed]', config.url, error.message)`

**3. Portfolio Load Failures**
- **Location**: `src/pages/PortfolioView/PortfolioView.jsx`
- **Gap**: No logging when portfolio fails to load
- **Impact**: Cannot debug why specific portfolios don't load
- **Proposed**: Log in catch block: `console.error('Portfolio load failed:', portfolioId, error)`

### Silent Failures

**1. MongoDB Connection Loss**
- **Location**: All API routes using `connectDB()`
- **Gap**: Connection errors may not be logged if caught generically
- **Impact**: Appears to work but queries fail silently
- **Proposed**: Already handled in `portfolios.js` (line 243-256), but should be in all routes

**2. File Upload Disk Full**
- **Location**: `pages/api/upload/*.js`
- **Gap**: Disk full errors may not be caught
- **Impact**: Upload appears to succeed but file not saved
- **Proposed**: Check disk space before upload, log if <10% free

**3. JWT Token Expiration**
- **Location**: `lib/auth.js` (protect middleware)
- **Gap**: Expired tokens return 401 but no logging
- **Impact**: Cannot detect if users are being logged out unexpectedly
- **Proposed**: Log expired tokens: `console.log('Token expired for user:', userId)`

### Error Boundaries (Frontend)

**Current State**: No error boundaries found in codebase

**Proposed (Minimal)**:
- Add error boundary at App level (`src/App.jsx`)
- Catch React errors and show user-friendly message
- Log errors to console with context
- **Safe to add**: Yes, non-breaking, only catches unhandled errors

---

## 🩹 Hotfix Safety Map

### Safe to Hotfix

**Frontend Files (UI/UX Only)**:
- `src/components/**/*.jsx` - UI components (styling, text, layout)
- `src/styles/**/*.css` - CSS files (design tokens, animations)
- `src/pages/**/*.css` - Page-specific styles
- `src/utils/helpers.js` - Utility functions (formatting, validation)
- `src/translations/en.json` - Translation strings

**Backend Files (Non-Critical)**:
- `pages/api/health.js` - Health check endpoint
- Error messages in `lib/api-helpers.js` (sendError function)
- Logging statements (adding logs, not changing logic)
- `lib/contact-masking.js` - Masking logic (safe to adjust format)

**Configuration Files**:
- `.env` files (environment variables)
- `vite.config.js` - Build configuration
- `next.config.js` - Next.js configuration

**Documentation**:
- All `.md` files
- Comments in code

**Why Safe**: These changes don't affect business logic, data integrity, or API contracts.

---

### Do NOT Touch

**Authentication & Authorization**:
- `lib/auth.js` - JWT generation, token verification
- `middleware/auth.js` - Authentication middleware
- `pages/api/auth/*.js` - All auth endpoints (login, register, me)
- `middleware/portfolio-access.js` - Access control logic

**Database Models**:
- `models/*.js` - All Mongoose models (User, Portfolio, etc.)
- Schema definitions

**Core Business Logic**:
- `lib/portfolio-helper.js` - Portfolio creation, updates
- `lib/verification-helper.js` - Verification logic
- `lib/ils-calculation.js` - ILS level calculations
- `lib/portfolio-rating.js` - Rating calculations

**API Contracts**:
- Request/response formats in `pages/api/**/*.js`
- API endpoint signatures
- Data validation in `lib/validation.js`

**File Upload Logic**:
- `lib/upload.js` - File upload handling
- `pages/api/upload/*.js` - Upload endpoints

**Database Queries**:
- Query logic in `pages/api/portfolios.js`
- Search implementation
- Pagination logic

**Why Not Safe**: Changes can break data integrity, security, or cause data loss.

---

### ⚠️ High-Risk Areas

**1. Authentication Endpoints**
- **Files**: `pages/api/auth/login.js`, `pages/api/auth/register.js`
- **Risk**: High traffic, security-critical, brute force attacks
- **Load Risk**: Can be overwhelmed with requests
- **Mitigation**: 
  - Monitor failed login attempts
  - Watch for unusual request patterns
  - Consider adding simple delay on failed attempts (if needed)

**2. Portfolio Listing Endpoint**
- **File**: `pages/api/portfolios.js`
- **Risk**: Complex queries, search, pagination, high traffic
- **Load Risk**: Slow queries with large datasets, memory usage
- **Mitigation**:
  - Monitor query response times
  - Watch for large `limit` values (>100)
  - Monitor MongoDB connection pool

**3. File Upload Endpoints**
- **Files**: `pages/api/upload/*.js`, `pages/api/olympiads/upload-*.js`
- **Risk**: Disk I/O, large files, disk space exhaustion
- **Load Risk**: Multiple concurrent uploads can fill disk
- **Mitigation**:
  - Monitor disk space usage
  - Watch for upload failures
  - Check file permissions

**4. Portfolio Search**
- **File**: `pages/api/portfolios.js` (line 162-183)
- **Risk**: In-memory filtering, regex performance, large result sets
- **Load Risk**: Slow searches with many portfolios
- **Mitigation**:
  - Monitor search query performance
  - Watch for regex errors
  - Log search terms for analysis

**5. Database Connection**
- **File**: `lib/mongodb.js`
- **Risk**: Connection pool exhaustion, network issues
- **Load Risk**: Too many concurrent connections
- **Mitigation**:
  - Monitor MongoDB connection count
  - Watch for connection errors
  - Check MongoDB Atlas metrics (if using)

**6. JWT Token Generation**
- **File**: `lib/auth.js`
- **Risk**: Token generation overhead, secret rotation issues
- **Load Risk**: High auth request volume
- **Mitigation**:
  - Monitor token generation time
  - Watch for JWT_SECRET errors

---

## 🚨 Failure Scenarios & Mitigations

### 1. Database Connection Loss

**Symptoms**:
- API returns 503 errors
- PM2 logs show "MongooseServerSelectionError"
- Health endpoint fails

**Fastest Detection**:
```bash
# Check PM2 logs
pm2 logs olympiad-backend --lines 50 | grep -i "mongo\|connection"

# Check health endpoint
curl http://localhost:3000/api/health
```

**Safest Mitigation**:
1. **Restart backend**: `pm2 restart olympiad-backend`
2. **Check MongoDB status**: Verify MongoDB is running (Atlas dashboard or local service)
3. **Verify connection string**: Check `.env` file `MONGODB_URI`
4. **If persistent**: Check network/firewall rules

**Rollback**: Not needed (no code change)

---

### 2. File Upload Disk Full

**Symptoms**:
- Uploads fail with "ENOSPC" or "disk full" errors
- PM2 logs show write errors
- Users report upload failures

**Fastest Detection**:
```bash
# Check disk space
df -h

# Check upload directory
ls -lh uploads/
du -sh uploads/

# Check PM2 logs
pm2 logs olympiad-backend | grep -i "upload\|ENOSPC"
```

**Safest Mitigation**:
1. **Free disk space**: Delete old uploads or expand disk
2. **Temporary fix**: Increase `MAX_FILE_SIZE` in `.env` (if too large)
3. **Long-term**: Implement file cleanup job

**Rollback**: Not needed (infrastructure issue)

---

### 3. High Memory Usage / Memory Leak

**Symptoms**:
- Server becomes slow
- PM2 shows high memory usage
- OOM (Out of Memory) errors in logs

**Fastest Detection**:
```bash
# Check PM2 memory
pm2 monit

# Check system memory
free -h

# Check for memory leaks in logs
pm2 logs olympiad-backend | grep -i "memory\|heap"
```

**Safest Mitigation**:
1. **Restart backend**: `pm2 restart olympiad-backend` (clears memory)
2. **Monitor**: Watch if memory grows again
3. **If persistent**: Check for unclosed database connections or large data loads

**Rollback**: Not needed (restart clears state)

---

### 4. Search Performance Degradation

**Symptoms**:
- Portfolio search takes >5 seconds
- Users report slow searches
- High CPU usage during searches

**Fastest Detection**:
```bash
# Check response times
curl -w "@-" -o /dev/null -s "http://localhost:3000/api/portfolios?search=test" <<< "time_total: %{time_total}\n"

# Check PM2 logs for slow queries
pm2 logs olympiad-backend | grep -i "search\|slow"
```

**Safest Mitigation**:
1. **Restart backend**: May help if connection pool exhausted
2. **Config tweak**: Reduce default `limit` in search queries
3. **Database**: Check MongoDB indexes (should auto-create, but verify)

**Rollback**: Revert limit change if needed

---

### 5. Authentication Token Issues

**Symptoms**:
- Users randomly logged out
- 401 errors for valid tokens
- JWT_SECRET errors in logs

**Fastest Detection**:
```bash
# Check for JWT errors
pm2 logs olympiad-backend | grep -i "jwt\|token\|unauthorized"

# Test auth endpoint
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
```

**Safest Mitigation**:
1. **Check JWT_SECRET**: Verify `.env` has valid secret
2. **Restart backend**: Ensures new secret is loaded
3. **If secret changed**: All users must re-login (expected)

**Rollback**: Restore previous JWT_SECRET in `.env` (users must re-login)

---

### 6. CORS Errors

**Symptoms**:
- Frontend can't call API
- Browser console shows CORS errors
- 405 Method Not Allowed errors

**Fastest Detection**:
```bash
# Check browser console (user report)
# Check PM2 logs for CORS issues
pm2 logs olympiad-backend | grep -i "cors\|origin"

# Test CORS
curl -H "Origin: https://yourdomain.com" -H "Access-Control-Request-Method: POST" -X OPTIONS http://localhost:3000/api/auth/login
```

**Safest Mitigation**:
1. **Config tweak**: Update `FRONTEND_URL` in `.env` to match actual frontend URL
2. **Restart backend**: `pm2 restart olympiad-backend`
3. **Verify**: Check CORS headers in response

**Rollback**: Revert `FRONTEND_URL` if needed

---

### 7. Pagination Abuse

**Symptoms**:
- Slow portfolio listing
- High database load
- Memory usage spikes

**Fastest Detection**:
```bash
# Check for large limit values in logs
pm2 logs olympiad-backend | grep -i "limit.*[0-9]\{3,\}"

# Monitor API response times
# Watch for requests with limit > 100
```

**Safest Mitigation**:
1. **Config tweak**: Add max limit check in `portfolios.js`:
   ```javascript
   const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Cap at 100
   ```
2. **Restart backend**: `pm2 restart olympiad-backend`

**Rollback**: Remove limit cap if needed

---

### 8. File Upload Size Abuse

**Symptoms**:
- Disk fills quickly
- Uploads fail
- Server becomes unresponsive

**Fastest Detection**:
```bash
# Check disk space
df -h

# Check file sizes in uploads/
find uploads/ -type f -size +50M

# Check PM2 logs
pm2 logs olympiad-backend | grep -i "file.*size\|MAX_FILE_SIZE"
```

**Safest Mitigation**:
1. **Config tweak**: Reduce `MAX_FILE_SIZE` in `.env` (e.g., 50MB instead of 100MB)
2. **Restart backend**: `pm2 restart olympiad-backend`
3. **Cleanup**: Delete oversized files if needed

**Rollback**: Increase `MAX_FILE_SIZE` back if needed

---

### 9. MongoDB Query Timeout

**Symptoms**:
- API requests timeout
- 500 errors
- "Query timeout" in logs

**Fastest Detection**:
```bash
# Check for timeout errors
pm2 logs olympiad-backend | grep -i "timeout\|query.*slow"

# Check MongoDB connection
# (MongoDB Atlas dashboard or local logs)
```

**Safest Mitigation**:
1. **Restart backend**: Clears connection pool
2. **Database**: Check MongoDB performance (Atlas metrics)
3. **Indexes**: Verify indexes exist (should auto-create)

**Rollback**: Not needed (infrastructure/query issue)

---

### 10. Frontend Build/Deploy Issues

**Symptoms**:
- Frontend shows blank page
- JavaScript errors in console
- API calls fail from frontend

**Fastest Detection**:
```bash
# Check browser console (user report)
# Check if dist/ directory exists and has files
ls -la UNI-STEM-Front/dist/

# Test frontend load
curl -I https://yourdomain.com
```

**Safest Mitigation**:
1. **Rebuild frontend**: `cd UNI-STEM-Front && npm run build`
2. **Redeploy**: Copy new `dist/` to web server
3. **Verify**: Check browser console for errors

**Rollback**: Restore previous `dist/` directory from backup

---

## 📊 Monitoring Priorities (First 7-14 Days)

### Hourly Checks
- PM2 process status: `pm2 status`
- Health endpoint: `curl http://localhost:3000/api/health`
- Disk space: `df -h`
- Error rate in logs: `pm2 logs olympiad-backend --lines 100 | grep -i error | wc -l`

### Daily Checks
- MongoDB connection pool usage
- File upload success rate
- Search query performance
- Memory usage trends

### Weekly Checks
- Database size growth
- Upload directory size
- Error pattern analysis
- User registration/login trends

---

## 🎯 Quick Reference

### Emergency Commands

```bash
# Restart backend
pm2 restart olympiad-backend

# Check logs
pm2 logs olympiad-backend --lines 50

# Check health
curl http://localhost:3000/api/health

# Check disk space
df -h

# Check memory
free -h
pm2 monit
```

### Safe Hotfix Checklist

Before making any hotfix:
- [ ] File is in "Safe to Hotfix" list
- [ ] Change is minimal and reversible
- [ ] Tested locally (if possible)
- [ ] Backup current version
- [ ] Document the change
- [ ] Monitor after deployment

### Do NOT Hotfix If

- [ ] File is in "Do NOT Touch" list
- [ ] Change affects API contracts
- [ ] Change affects database schema
- [ ] Change affects authentication/authorization
- [ ] Change is not easily reversible

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: READY FOR POST-LAUNCH MONITORING

