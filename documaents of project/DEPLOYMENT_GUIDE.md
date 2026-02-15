# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Global Olympiad platform to production.

---

## 📋 Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **MongoDB**: Version 5.0 or higher (local or MongoDB Atlas)
- **npm**: Version 9 or higher (comes with Node.js)
- **Operating System**: Windows, Linux, or macOS

### Server Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB+ recommended
- **Disk Space**: 10GB+ for application, additional space for uploads
- **Network**: Outgoing HTTPS for MongoDB Atlas (if used)

### Domain & SSL

- Domain name for frontend (e.g., `olympiad.example.com`)
- Domain name for backend API (e.g., `api.globalolympiad.example.com`)
- SSL certificates for HTTPS (Let's Encrypt recommended)

---

## 🔧 Pre-Deployment Checklist

- [ ] MongoDB database created and accessible
- [ ] Environment variables documented and ready
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] File upload directory created with proper permissions
- [ ] Google OAuth credentials configured for production
- [ ] Backup strategy defined
- [ ] Monitoring setup planned

---

## 🗄️ Step 1: MongoDB Setup

### Option A: MongoDB Atlas (Cloud - Recommended)

1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Create database user
4. Whitelist server IP address (or 0.0.0.0/0 for all IPs - less secure)
5. Get connection string:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/olympiad-platform?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB

1. Install MongoDB on server
2. Start MongoDB service
3. Connection string format:

   ```
   mongodb://127.0.0.1:27017/olympiad-platform
   ```

4. Ensure MongoDB is accessible from backend application

**Windows MongoDB Setup**: See `UNI-STEM-beckend/MONGODB_SETUP_WINDOWS.md`

---

## 🔐 Step 2: Environment Configuration

### Backend Environment Variables

Create `.env` file in `UNI-STEM-beckend/`:

```env
# Required
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/olympiad-platform
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# Optional (with defaults)
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://olympiad.example.com
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=104857600
HOST=0.0.0.0

# Google OAuth (if using)
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Security Notes**:

- Generate a strong `JWT_SECRET` (32+ characters, random)
- Never commit `.env` file to version control
- Use different secrets for development and production

### Frontend Environment Variables

Create `.env` file in `UNI-STEM-Front/` (optional, can use defaults):

```env
VITE_API_URL=https://api.globalolympiad.example.com/api
VITE_SOCKET_URL=https://api.globalolympiad.example.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Note**: If using same domain with reverse proxy, you can use relative URLs:

```env
VITE_API_URL=/api
VITE_SOCKET_URL=
```

---

## 🏗️ Step 3: Backend Deployment

### 3.1 Install Dependencies

```bash
cd UNI-STEM-beckend
npm install --production
```

### 3.2 Create Upload Directory

```bash
mkdir -p uploads/olympiads
mkdir -p uploads/users
chmod 755 uploads
```

### 3.3 Build (Optional - Next.js)

Since we're using API routes only, building is optional but recommended:

```bash
npm run build
```

### 3.4 Start Server

**Development/Testing:**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

**Using PM2 (Recommended for Production):**

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name "olympiad-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

**PM2 Management:**

```bash
pm2 list              # List processes
pm2 logs              # View logs
pm2 restart olympiad-backend  # Restart
pm2 stop olympiad-backend     # Stop
pm2 delete olympiad-backend   # Remove
```

---

## 🎨 Step 4: Frontend Deployment

### 4.1 Install Dependencies

```bash
cd UNI-STEM-Front
npm install
```

### 4.2 Build for Production

```bash
npm run build
```

This creates a `dist/` directory with optimized production build.

### 4.3 Serve Frontend

**Option A: Nginx (Recommended)**

1. Install Nginx
2. Configure Nginx:

```nginx
server {
    listen 80;
    server_name olympiad.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name olympiad.example.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Frontend
    root /path/to/UNI-STEM-Front/dist;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy Socket.io
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

1. Test configuration:

```bash
nginx -t
```

1. Reload Nginx:

```bash
nginx -s reload
```

**Option B: Apache**

1. Install Apache
2. Enable mod_rewrite
3. Create `.htaccess` in `dist/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Option C: Node.js Static Server (Not Recommended for Production)**

```bash
npm install -g serve
serve -s dist -l 80
```

---

## 🔄 Step 5: Reverse Proxy Setup (Optional)

If using separate domains for frontend and backend, or need more control:

### Nginx Reverse Proxy for Backend

```nginx
server {
    listen 443 ssl http2;
   server_name api.globalolympiad.example.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

---

## ✅ Step 6: Post-Deployment Verification

### 6.1 Health Check

Test backend health endpoint:

```bash
curl https://api.globalolympiad.example.com/api/health
```

Expected response:

```json
{"status":"ok","message":"Server is running"}
```

### 6.2 Frontend Access

1. Open browser: `https://olympiad.example.com`
2. Verify frontend loads correctly
3. Check browser console for errors

### 6.3 API Connection

1. Try user registration/login
2. Verify API calls work from frontend
3. Check Network tab in browser DevTools

### 6.4 Socket.io Connection

1. Start an olympiad or open real-time feature
2. Verify Socket.io connection established
3. Check for connection errors in console

### 6.5 File Uploads

1. Test file upload (profile picture, portfolio logo, etc.)
2. Verify files saved to `uploads/` directory
3. Check file permissions

### 6.6 Database Connection

1. Verify MongoDB connection in backend logs
2. Test database operations (create user, portfolio, etc.)
3. Check MongoDB logs for errors

---

## 🔒 Step 7: Security Hardening

### 7.1 Firewall Configuration

Allow only necessary ports:

```bash
# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct access to backend port (if using reverse proxy)
ufw deny 3000/tcp
```

### 7.2 SSL/TLS Configuration

Use strong SSL/TLS settings in Nginx:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

### 7.3 Environment Variable Security

- Never commit `.env` files
- Use secrets management (e.g., AWS Secrets Manager, HashiCorp Vault)
- Rotate JWT_SECRET periodically
- Use different secrets for each environment

### 7.4 File Upload Security

- Validate file types server-side
- Limit file sizes
- Scan uploaded files for malware
- Store uploads outside web root (if possible)

---

## 📊 Step 8: Monitoring & Logging

### 8.1 Application Logs

**PM2 Logs:**

```bash
pm2 logs olympiad-backend
```

**Nginx Logs:**

- Access: `/var/log/nginx/access.log`
- Error: `/var/log/nginx/error.log`

### 8.2 Process Monitoring

**PM2 Monitoring:**

```bash
pm2 monit
```

### 8.3 Database Monitoring

- Monitor MongoDB connection pool
- Watch for slow queries
- Track database size growth

### 8.4 Recommended Monitoring Tools

- **Application**: PM2 Plus, New Relic, DataDog
- **Infrastructure**: Prometheus + Grafana
- **Errors**: Sentry
- **Uptime**: UptimeRobot, Pingdom

---

## 🔄 Step 9: Backup Strategy

### 9.1 Database Backups

**MongoDB Atlas**: Automatic backups (if using Atlas)

**Local MongoDB:**

```bash
# Create backup
mongodump --uri="mongodb://localhost:27017/olympiad-platform" --out=/backup/olympiad-$(date +%Y%m%d)

# Restore backup
mongorestore --uri="mongodb://localhost:27017/olympiad-platform" /backup/olympiad-20241201
```

### 9.2 File Uploads Backup

```bash
# Backup uploads directory
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Store in secure location (S3, etc.)
```

### 9.3 Configuration Backup

- Backup `.env` files securely
- Document all configuration changes
- Version control configuration templates (without secrets)

---

## 🚨 Troubleshooting

### Backend Won't Start

1. Check MongoDB connection
2. Verify JWT_SECRET is set
3. Check port 3000 is available
4. Review error logs

### Frontend Can't Connect to API

1. Verify `VITE_API_URL` is correct
2. Check CORS configuration in backend
3. Verify reverse proxy configuration
4. Check firewall rules

### File Uploads Fail

1. Check `uploads/` directory permissions
2. Verify disk space available
3. Check `MAX_FILE_SIZE` setting
4. Review file upload endpoint logs

### Socket.io Connection Issues

1. Verify Socket.io path configuration
2. Check WebSocket support in proxy
3. Verify CORS settings for Socket.io
4. Check network connectivity

---

## 🔄 Update/Deployment Process

### Updating Application

1. **Pull latest code**

   ```bash
   git pull origin main
   ```

2. **Update dependencies** (if needed)

   ```bash
   npm install
   ```

3. **Rebuild frontend** (if frontend changed)

   ```bash
   cd UNI-STEM-Front
   npm run build
   ```

4. **Restart backend**

   ```bash
   pm2 restart olympiad-backend
   ```

5. **Reload Nginx** (if config changed)

   ```bash
   nginx -s reload
   ```

### Rollback Procedure

1. **Restore previous code version**

   ```bash
   git checkout <previous-commit>
   ```

2. **Restore database backup** (if schema changed)

   ```bash
   mongorestore --uri="..." /backup/previous-backup
   ```

3. **Restart services**

   ```bash
   pm2 restart olympiad-backend
   ```

---

## 📝 Deployment Checklist

- [ ] MongoDB database created and accessible
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Backend dependencies installed
- [ ] Backend server started and running
- [ ] Frontend built successfully
- [ ] Frontend served via web server
- [ ] Reverse proxy configured (if needed)
- [ ] Health check passes
- [ ] API endpoints accessible
- [ ] Socket.io connection works
- [ ] File uploads working
- [ ] User registration/login tested
- [ ] Security hardening applied
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Documentation updated

---

**Last Updated**: December 2024  
**Version**: 1.0
