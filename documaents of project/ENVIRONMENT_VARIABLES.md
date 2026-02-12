# Environment Variables Reference

Complete documentation of all environment variables used in the UNI STEM platform.

---

## 🔴 Backend Environment Variables

### Required Variables

These variables **must** be set for the backend to function properly.

#### `MONGODB_URI`

**Description**: MongoDB connection string  
**Required**: YES  
**Format**: `mongodb://[username:password@]host[:port][/database][?options]` or `mongodb+srv://...` for Atlas  
**Example**:

```
mongodb://127.0.0.1:27017/olympiad-platform
mongodb+srv://user:pass@cluster.mongodb.net/olympiad-platform?retryWrites=true&w=majority
```

**Default**: `mongodb://127.0.0.1:27017/olympiad-platform`  
**Location**: Used in `lib/mongodb.js`

---

#### `JWT_SECRET`

**Description**: Secret key for signing JWT tokens  
**Required**: YES  
**Format**: String (minimum 32 characters recommended)  
**Example**: `your-super-secret-jwt-key-min-32-characters-long`  
**Default**: None (application will fail to start if not set)  
**Security**:

- Must be a strong, random string
- Never commit to version control
- Use different secrets for each environment
- Rotate periodically in production
**Location**: Used in `lib/auth.js`, `pages/api/auth/register.js`, `server.js`

---

### Optional Variables

These variables have defaults but can be overridden.

#### `PORT`

**Description**: Port number for the backend server  
**Required**: NO  
**Type**: Integer  
**Example**: `3000`  
**Default**: `3000`  
**Location**: Used in `server.js`

---

#### `NODE_ENV`

**Description**: Node.js environment mode  
**Required**: NO  
**Values**: `development`, `production`, `test`  
**Example**: `production`  
**Default**: `development` (or system NODE_ENV)  
**Effects**:

- Controls error message detail (full stack traces in development)
- Affects some logging behavior
**Location**: Used throughout backend code

---

#### `FRONTEND_URL`

**Description**: Frontend application URL for CORS configuration  
**Required**: NO  
**Format**: URL (protocol + domain + optional port)  
**Example**:

```
http://localhost:5173
https://unistem.example.com
```

**Default**: `http://localhost:5173`  
**Location**: Used in `server.js`, `middleware/cors.js`, `lib/api-helpers.js`, `next.config.js`  
**Note**: Must match the actual frontend URL exactly

---

#### `HOST`

**Description**: Hostname/IP address to bind the server to  
**Required**: NO  
**Example**: `0.0.0.0` (all interfaces), `127.0.0.1` (localhost only)  
**Default**: `0.0.0.0`  
**Location**: Used in `server.js`  
**Note**: Use `0.0.0.0` to accept connections from all network interfaces

---

#### `UPLOAD_PATH`

**Description**: Directory path for file uploads  
**Required**: NO  
**Format**: Relative or absolute path  
**Example**:

```
./uploads
/var/www/uploads
C:\uploads
```

**Default**: `./uploads`  
**Location**: Used in various upload endpoints:

- `pages/api/olympiads/upload-video.js`
- `pages/api/olympiads/upload-screenshot.js`
- `pages/api/olympiads/camera-capture.js`
- `pages/api/auth/upload-logo.js`
- `pages/api/admin/olympiads/upload-logo.js`
**Requirements**:
- Directory must exist
- Directory must be writable by the application
- Ensure sufficient disk space

---

#### `MAX_FILE_SIZE`

**Description**: Maximum file size for uploads in bytes  
**Required**: NO  
**Type**: Integer (bytes)  
**Example**: `104857600` (100MB)  
**Default**: `104857600` (100MB)  
**Location**: Used in `lib/upload.js`  
**Common Values**:

- 10MB: `10485760`
- 50MB: `52428800`
- 100MB: `104857600`
- 200MB: `209715200`

---

#### `FFMPEG_QUEUE_CONCURRENCY`

**Description**: Max concurrent FFmpeg video processing jobs (limits CPU load)  
**Required**: NO  
**Type**: Integer  
**Example**: `4`  
**Default**: `4`  
**Location**: Used in `lib/ffmpeg-queue.js`  
**Note**: Recommended 3-5 for 100 concurrent users

---

#### `JWT_EXPIRE`

**Description**: JWT token expiration time  
**Required**: NO  
**Format**: String (zeit/ms format)  
**Example**: `7d`, `24h`, `30m`  
**Default**: `7d` (7 days)  
**Location**: Used in `lib/auth.js`

---

#### `SMTP_HOST`

**Description**: SMTP server host for email sending  
**Required**: YES (for password setup emails)  
**Format**: Hostname  
**Example**: `smtp.gmail.com`  
**Default**: None  
**Location**: Used in `lib/email.js`

---

#### `SMTP_PORT`

**Description**: SMTP server port  
**Required**: YES (for password setup emails)  
**Type**: Integer  
**Example**: `587` (STARTTLS), `465` (SSL)  
**Default**: `587`  
**Location**: Used in `lib/email.js`

---

#### `SMTP_USER`

**Description**: SMTP username/login  
**Required**: YES (for password setup emails)  
**Format**: String  
**Example**: `no-reply@unistem.example.com`  
**Default**: None  
**Location**: Used in `lib/email.js`

---

#### `SMTP_PASS`

**Description**: SMTP password (or app password)  
**Required**: YES (for password setup emails)  
**Format**: String  
**Example**: `app-password-or-smtp-password`  
**Default**: None  
**Location**: Used in `lib/email.js`

---

#### `SMTP_FROM`

**Description**: From address for outgoing emails  
**Required**: YES (for password setup emails)  
**Format**: Email address  
**Example**: `"UNI STEM" <no-reply@unistem.example.com>`  
**Default**: Falls back to `SMTP_USER`  
**Location**: Used in `lib/email.js`

---

#### `RESET_PASSWORD_PATH`

**Description**: Frontend path for password setup UI  
**Required**: NO  
**Format**: URL path  
**Example**: `/updatepassword`  
**Default**: `/updatepassword`  
**Location**: Used in `pages/api/auth/login.js`

---

#### `VERIFY_EMAIL_PATH`

**Description**: Frontend path for email verification UI  
**Required**: NO  
**Format**: URL path  
**Example**: `/verify-email`  
**Default**: `/verify-email`  
**Location**: Used in `pages/api/auth/register.js`, `pages/api/auth/login.js`

---

#### `EMAIL_VERIFY_TTL_HOURS`

**Description**: Email verification link TTL in hours  
**Required**: NO  
**Type**: Integer  
**Example**: `24`  
**Default**: `24`  
**Location**: Used in `pages/api/auth/register.js`, `pages/api/auth/login.js`

---

#### `PASSWORD_RESET_TTL_HOURS`

**Description**: Password setup link TTL in hours  
**Required**: NO  
**Type**: Integer  
**Example**: `6`  
**Default**: `6`  
**Location**: Used in `pages/api/auth/login.js`

---

#### `GOOGLE_CLIENT_SECRET`

**Description**: Google OAuth 2.0 client secret  
**Required**: NO (only if using Google OAuth)  
**Format**: String  
**Example**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxx`  
**Default**: None  
**Location**: Used in Google OAuth authentication endpoints  
**Security**: Never commit to version control

---

## 🟢 Frontend Environment Variables

All frontend environment variables are **optional** and have defaults. They must be prefixed with `VITE_` to be accessible in Vite applications.

### `VITE_API_URL`

**Description**: Base URL for API requests  
**Required**: NO  
**Format**: URL  
**Example**:

```
http://localhost:3000/api
https://api.unistem.example.com/api
/api
```

**Default**:

- Development: `/api` (uses Vite proxy)
- Production: `http://localhost:3000/api`
**Location**: Used in:
- `src/utils/constants.js`
- `src/pages/Dashboard/Dashboard.jsx`
- `src/pages/UniversityPanel/UniversityPanel.jsx`
- `src/pages/AdminPanel/AdminPanel.jsx`
**Note**: In production with reverse proxy, use `/api` for relative URLs

---

### `VITE_SOCKET_URL`

**Description**: Socket.io server URL  
**Required**: NO  
**Format**: URL (without path)  
**Example**:

```
http://localhost:3000
https://api.unistem.example.com
```

**Default**: `http://localhost:3000`  
**Location**: Used in `src/utils/constants.js`, `src/services/socket.js`  
**Note**: Omit for same-origin (empty string will use current origin)

---

### `VITE_GOOGLE_CLIENT_ID`

**Description**: Google OAuth 2.0 client ID  
**Required**: NO (only if using Google OAuth)  
**Format**: String  
**Example**: `780692716304-xxxxxxxxxxxxx.apps.googleusercontent.com`  
**Default**: `780692716304-p2k6rmk2gtlrhrrf1ltncl986b1hqgrf.apps.googleusercontent.com` (hardcoded fallback)  
**Location**: Used in `src/utils/constants.js`  
**Note**: The hardcoded fallback in constants.js should be replaced with environment variable in production

---

## 📝 Environment File Examples

### Backend `.env` File

Create this file in `UNI-STEM-beckend/`:

```env
# Required
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/olympiad-platform?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-min-32-characters-long-random-string

# Optional (with defaults)
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://unistem.example.com
HOST=0.0.0.0
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=104857600
JWT_EXPIRE=7d

# Google OAuth (optional)
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```

---

### Frontend `.env` File

Create this file in `UNI-STEM-Front/`:

```env
# Optional (with defaults)
VITE_API_URL=https://api.unistem.example.com/api
VITE_SOCKET_URL=https://api.unistem.example.com
VITE_GOOGLE_CLIENT_ID=780692716304-xxxxxxxxxxxxx.apps.googleusercontent.com
```

**For same-domain setup with reverse proxy:**

```env
VITE_API_URL=/api
VITE_SOCKET_URL=
VITE_GOOGLE_CLIENT_ID=780692716304-xxxxxxxxxxxxx.apps.googleusercontent.com
```

---

## 🔒 Security Best Practices

### General Security

1. **Never commit `.env` files** to version control
   - Add `.env` to `.gitignore`
   - Use `.env.example` files with placeholder values

2. **Use strong secrets**
   - `JWT_SECRET`: Minimum 32 characters, random
   - Use password generators or `openssl rand -hex 32`

3. **Use different values for each environment**
   - Development, staging, and production should have different secrets
   - Never reuse production secrets in development

4. **Rotate secrets periodically**
   - Change `JWT_SECRET` every 90 days (requires all users to re-login)
   - Update OAuth credentials if compromised

5. **Limit access to `.env` files**
   - Use file permissions (600 on Linux/Mac: `chmod 600 .env`)
   - Restrict access to production secrets

### Production Recommendations

1. **Use secrets management services**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Kubernetes Secrets

2. **Environment-specific files**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

3. **Monitor for exposed secrets**
   - Use tools like `git-secrets` or `truffleHog`
   - Regularly audit code repositories

---

## 🧪 Testing Environment Variables

### Backend Testing

```bash
# Test MongoDB connection
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(e => console.error(e))"

# Verify JWT_SECRET is set
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING')"
```

### Frontend Testing

```bash
# Build and check if variables are included
npm run build
grep -r "VITE_API_URL" dist/
```

---

## 🔍 Troubleshooting

### Backend Issues

**Problem**: Server fails to start with "JWT_SECRET is required"  
**Solution**: Ensure `JWT_SECRET` is set in `.env` file

**Problem**: MongoDB connection fails  
**Solution**:

- Verify `MONGODB_URI` is correct
- Check MongoDB is running
- Verify network access (firewall, IP whitelist)

**Problem**: CORS errors from frontend  
**Solution**: Verify `FRONTEND_URL` matches actual frontend URL exactly

### Frontend Issues

**Problem**: API calls fail with 404  
**Solution**: Verify `VITE_API_URL` is correct for production

**Problem**: Socket.io connection fails  
**Solution**: Verify `VITE_SOCKET_URL` is correct and accessible

**Problem**: Google OAuth doesn't work  
**Solution**: Verify `VITE_GOOGLE_CLIENT_ID` matches Google Cloud Console configuration

---

## 📚 Related Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment instructions
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Production readiness overview
- [BACKEND_GOOGLE_SETUP.md](./UNI-STEM-Front/docs/BACKEND_GOOGLE_SETUP.md) - Google OAuth setup

---

**Last Updated**: December 2024  
**Version**: 1.0
