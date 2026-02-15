# Global Olympiad v2.2

A comprehensive online platform for academic olympiads (Global Olympiad) with advanced proctoring features, portfolio management, and university dashboard.

---

## 🚀 Production Ready

This platform is **production-ready** with complete documentation for deployment and operations.

### 📚 Production Documentation

**Start here**: [HANDOFF.md](./HANDOFF.md) - Quick handoff overview

**Production Readiness**:
- **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** - Production readiness status and overview
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-launch verification checklist
- **[PRODUCTION_SAFETY.md](./PRODUCTION_SAFETY.md)** - Security and safety checklist
- **[KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** - Known issues and technical debt
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Environment variable reference

**Developer Documentation**:
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Getting started guide for new developers
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture documentation

---

## 📁 Project Structure

```
Global Olympiad/
├── UNI-STEM-Front/                   # Frontend (React + Vite)
│   ├── src/                          # Source code
│   ├── docs/                         # Frontend documentation
│   └── README.md                     # Frontend README
│
├── UNI-STEM-beckend/                 # Backend (Next.js API Routes)
│   ├── pages/api/                    # API endpoints
│   ├── models/                       # MongoDB models
│   ├── lib/                          # Utilities and helpers
│   └── README.md                     # Backend README
│
├── HANDOFF.md                        # Production handoff overview
├── PRODUCTION_READINESS.md           # Production readiness status
├── DEPLOYMENT_GUIDE.md               # Deployment instructions
├── PRODUCTION_CHECKLIST.md           # Pre-launch checklist
├── KNOWN_ISSUES.md                   # Known issues
├── ENVIRONMENT_VARIABLES.md          # Environment variables
└── README.md                         # This file
```

---

## 🏗️ Architecture Overview

### Technology Stack

**Frontend**:
- React 18.2.0
- Vite 7.2.6
- React Router 6.20.0
- Framer Motion 11.0.0
- Socket.io Client 4.5.4

**Backend**:
- Next.js 14.0.4 (API Routes)
- Node.js 18+
- MongoDB with Mongoose 8.0.3
- Socket.io 4.5.4
- JWT Authentication

### Key Features

- ✅ **Multi-page Portfolios** - Student portfolios with theme customization
- ✅ **Olympiad System** - Test and Essay formats with proctoring
- ✅ **University Dashboard** - Portfolio viewing and verification
- ✅ **Role-Based Access** - Student, Admin, Owner, University, Checker roles
- ✅ **Google OAuth** - Social authentication
- ✅ **Real-time Updates** - Socket.io for live updates
- ✅ **File Uploads** - Profile pictures, portfolio logos, proctoring captures

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Development Setup

**Backend**:
```bash
cd UNI-STEM-beckend
npm install
# Create .env file (see ENVIRONMENT_VARIABLES.md)
npm run dev
```

**Frontend**:
```bash
cd UNI-STEM-Front
npm install
# Create .env file (optional, see ENVIRONMENT_VARIABLES.md)
npm run dev
```

### Production Deployment

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for complete deployment instructions.

---

## 🔐 Configuration

### Required Environment Variables

**Backend** (`.env` file):
- `MONGODB_URI` - MongoDB connection string (REQUIRED)
- `JWT_SECRET` - JWT signing secret, 32+ characters (REQUIRED)
- `FRONTEND_URL` - Frontend URL for CORS

**Frontend** (`.env` file, optional):
- `VITE_API_URL` - API base URL
- `VITE_SOCKET_URL` - Socket.io server URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID

See **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** for complete documentation.

---

## 📊 System Status

### ✅ Production Ready

- Authentication and authorization
- Portfolio system
- University dashboard
- Olympiad management
- Role-based access control
- Data security and privacy

### ⚠️ Known Issues

4 critical issues documented in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md):
1. normalizeTheme loses containerWidth
2. Client-side pagination (should use backend pagination)
3. Search query performance (in-memory filtering)
4. Hardcoded padding values

**Status**: Functional for production use. Critical issues should be addressed before high-traffic scenarios.

---

## 📚 Documentation Index

### Production Documentation
- [HANDOFF.md](./HANDOFF.md) - Production handoff overview
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Production readiness status
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment instructions
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Pre-launch checklist
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Known issues and technical debt
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Environment variables

### Technical Documentation
- [UNI-STEM-Front/docs/API_ENDPOINTS.md](./UNI-STEM-Front/docs/API_ENDPOINTS.md) - API documentation
- [UNI-STEM-Front/README.md](./UNI-STEM-Front/README.md) - Frontend README
- [UNI-STEM-beckend/README.md](./UNI-STEM-beckend/README.md) - Backend README

### Setup Guides
- [UNI-STEM-Front/docs/BACKEND_GOOGLE_SETUP.md](./UNI-STEM-Front/docs/BACKEND_GOOGLE_SETUP.md) - Google OAuth setup
- [UNI-STEM-Front/docs/CONNECTION_GUIDE.md](./UNI-STEM-Front/docs/CONNECTION_GUIDE.md) - Connection guide
- [UNI-STEM-beckend/MONGODB_SETUP_WINDOWS.md](./UNI-STEM-beckend/MONGODB_SETUP_WINDOWS.md) - MongoDB setup

---

## 🧪 Testing

### Pre-Launch Checklist

Complete the [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before deploying to production.

### Verified Functionality

- ✅ User registration and authentication (Email + Google OAuth)
- ✅ Portfolio creation and editing
- ✅ Public portfolio viewing
- ✅ University dashboard access and filtering
- ✅ Role-based access control
- ✅ Olympiad creation and management
- ✅ Student submission flow
- ✅ Results and leaderboard display

---

## 🔒 Security

### Security Features

- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Data masking for personal information
- ✅ Portfolio visibility controls
- ✅ API endpoint protection
- ✅ CORS configuration
- ✅ File upload validation

**Security Status**: Production-ready with proper security measures.

---

## 📈 Performance

### Performance Characteristics

- **Small datasets** (< 1000 portfolios): Excellent performance
- **Medium datasets** (1000-10000): Good performance
- **Large datasets** (> 10000): Performance degradation expected

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for detailed performance notes and recommendations.

---

## 🆘 Support & Troubleshooting

### Common Issues

- MongoDB connection failures
- JWT secret missing errors
- CORS errors
- File upload failures

See [UNI-STEM-Front/docs/TROUBLESHOOTING.md](./UNI-STEM-Front/docs/TROUBLESHOOTING.md) for detailed troubleshooting.

---

## 📝 License

MIT

---

## 📞 Deployment Support

For deployment assistance:
1. Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Complete [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
3. Reference [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for configuration

---

**Version**: 2.2  
**Status**: Production Ready  
**Last Updated**: December 2024

