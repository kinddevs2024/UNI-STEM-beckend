# System Architecture

Technical architecture documentation for the UNI STEM platform.

---

## 🏗️ High-Level Architecture

### System Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │────────▶│   Frontend  │────────▶│   Backend   │
│  (Client)   │◀────────│  (React)    │◀────────│  (Next.js)  │
└─────────────┘         └─────────────┘         └─────────────┘
                                                       │
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │  MongoDB    │
                                                │  Database   │
                                                └─────────────┘
```

### Technology Stack

**Frontend**:
- React 18.2.0
- Vite 7.2.6
- React Router 6.20.0
- Framer Motion 11.0.0
- Axios 1.6.2
- Socket.io Client 4.5.4

**Backend**:
- Next.js 14.0.4 (API Routes)
- Node.js 18+
- MongoDB + Mongoose 8.0.3
- Socket.io 4.5.4
- JWT (jsonwebtoken 9.0.2)

**Infrastructure**:
- MongoDB (local or Atlas)
- File storage (local filesystem)
- Web server (Nginx/Apache for production)

---

## 🔄 Request Flow

### Authentication Flow

```
User Action          Frontend                Backend              Database
─────────────        ─────────               ───────              ────────

1. Login Request
   ───────────────▶  POST /api/auth/login
                      ──────────────────────────────────────▶
                                                    Verify Credentials
                                                    ──────────────────▶
                                                                       Query User
                                                                       ───────────
                                                    Generate JWT      ◀──────────
   ◀──────────────── JWT Token + User Data
   Store Token in localStorage

2. Authenticated Request
   ───────────────▶  GET /api/portfolio
                      Authorization: Bearer <token>
                      ──────────────────────────────────────▶
                                                    Validate JWT
                                                    Extract User/Role
                                                    ──────────────────▶
                                                                       Query Portfolio
                                                                       ───────────────
                                                    Filter by Role     ◀──────────────
   ◀──────────────── Portfolio Data
```

### Real-Time Communication Flow

```
Frontend (Socket.io Client)          Backend (Socket.io Server)
───────────────────────────          ───────────────────────────

Connect with auth token
────────────────────────────────────────────────────────────▶
                                        Validate Token
                                        Join User to Rooms

Timer Update (every second)
◀────────────────────────────────────────────────────────────
    Broadcast to Olympiad Room

Leaderboard Update
◀────────────────────────────────────────────────────────────
    Broadcast to Olympiad Room

User Action (submit answer)
────────────────────────────────────────────────────────────▶
                                        Process Submission
                                        Update Results
                                        Broadcast Update
◀────────────────────────────────────────────────────────────
    Updated Leaderboard
```

---

## 📦 Frontend Architecture

### Component Hierarchy

```
App
├── AuthProvider (Context)
├── SocketProvider (Context)
├── ThemeProvider (Context)
├── TranslationProvider (Context)
├── CookieConsentModal
└── Router
    ├── Public Routes
    │   ├── Home
    │   ├── About
    │   ├── Contact
    │   ├── PortfolioView (public)
    │   └── Auth (Login/Register)
    └── Protected Routes
        ├── Dashboard
        ├── Profile
        ├── PortfolioConstructor
        ├── AdminPanel (admin/owner)
        ├── UniversityPanel (university)
        └── ... (role-based routes)
```

### State Management

**Context API Pattern**:
- **AuthContext**: User authentication state, login/logout
- **SocketContext**: Socket.io connection and events
- **ThemeContext**: UI theme (light/dark)
- **TranslationContext**: i18n translations
- **PortfolioEditorContext**: Portfolio editing state
- **VerificationContext**: Portfolio verification state

**Local State**:
- Component-level state with `useState`
- Form state with controlled components
- Complex state with `useReducer` (where needed)

### Routing

**Public Routes**:
- `/` - Home page
- `/about` - About page
- `/contact` - Contact page
- `/portfolio/:id` - Public portfolio view
- `/auth` - Login/Register

**Protected Routes**:
- `/dashboard` - User dashboard
- `/profile` - User profile
- `/portfolio/edit/:id` - Portfolio editor
- `/admin` - Admin panel (admin/owner roles)
- `/university` - University dashboard (university role)

**Route Protection**:
```javascript
<Route 
  path="/admin" 
  element={
    <ProtectedRoute allowedRoles={['admin', 'owner']}>
      <AdminPanel />
    </ProtectedRoute>
  } 
/>
```

---

## 🔌 Backend Architecture

### API Structure

**Next.js API Routes**:
- Each file in `pages/api/` is an API endpoint
- RESTful conventions (GET, POST, PUT, DELETE)
- File-based routing (e.g., `pages/api/users/[id].js` → `/api/users/:id`)

**Endpoint Categories**:

1. **Authentication** (`/api/auth/`):
   - `POST /api/auth/register` - User registration
   - `POST /api/auth/login` - User login
   - `POST /api/auth/google` - Google OAuth
   - `GET /api/auth/me` - Get current user

2. **Portfolio** (`/api/portfolio/`):
   - `GET /api/portfolio/:id` - Get portfolio
   - `POST /api/portfolio` - Create portfolio
   - `PUT /api/portfolio/:id` - Update portfolio
   - `DELETE /api/portfolio/:id` - Delete portfolio

3. **Portfolios** (`/api/portfolios`):
   - `GET /api/portfolios` - List portfolios (with filters, pagination)

4. **Admin** (`/api/admin/`):
   - Olympiad management
   - Question management
   - User management
   - Submission viewing

5. **Owner** (`/api/owner/`):
   - Analytics
   - Reports
   - User role management

### Middleware Stack

```
Request
  │
  ├─▶ CORS Middleware (cors.js)
  │   └─▶ Allow/deny based on FRONTEND_URL
  │
  ├─▶ Authentication Middleware (auth.js)
  │   └─▶ Validate JWT token
  │   └─▶ Extract user and role
  │
  └─▶ Route Handler
      └─▶ Business Logic
      └─▶ Database Operations
      └─▶ Response
```

### Database Schema

**Core Models**:

1. **User**:
   - Authentication (email, password hash)
   - Profile (name, avatar)
   - Role (student, admin, owner, university, etc.)

2. **Portfolio**:
   - Owner (user reference)
   - Content (sections, blocks)
   - Theme (light/dark, container width)
   - Visibility (public/private)
   - Verification status

3. **Olympiad**:
   - Metadata (title, description, type)
   - Schedule (startTime, endTime, duration)
   - Status (draft, published, active, completed)
   - Questions (reference to Question model)

4. **Question**:
   - Olympiad reference
   - Question text
   - Type (multiple-choice, essay)
   - Options (for multiple-choice)
   - Correct answer
   - Points

5. **Submission**:
   - User reference
   - Olympiad reference
   - Answers (object with question IDs as keys)
   - Score
   - Submitted timestamp

6. **Result**:
   - User reference
   - Olympiad reference
   - Score and percentage
   - Rank
   - Completion timestamp

---

## 🔐 Security Architecture

### Authentication

**JWT-Based Authentication**:
1. User logs in with credentials
2. Backend validates and generates JWT
3. JWT includes: userId, email, role
4. Token stored in localStorage (frontend)
5. Token sent in `Authorization: Bearer <token>` header
6. Token expires after 7 days (configurable)

**Token Validation**:
- Middleware validates token on protected routes
- Token signature verified with JWT_SECRET
- User and role extracted from token payload
- Expired tokens rejected

### Authorization

**Role-Based Access Control (RBAC)**:
- Roles: student, admin, owner, university, checker, resolter, school-teacher
- Route-level protection (frontend)
- Endpoint-level protection (backend)
- Data-level filtering (e.g., universities see masked data)

**Access Control Examples**:
```javascript
// Frontend
<ProtectedRoute allowedRoles={['admin', 'owner']}>
  <AdminPanel />
</ProtectedRoute>

// Backend
if (!['admin', 'owner'].includes(user.role)) {
  return res.status(403).json({ message: 'Forbidden' });
}
```

### Data Protection

**Personal Data Masking**:
- Contact information masked for non-owners
- Universities see masked email/phone
- Implemented in `lib/contact-masking.js`

**Portfolio Visibility**:
- Public portfolios: accessible without authentication
- Private portfolios: only accessible to owner
- Backend checks `isPublic` or `visibility` flags

---

## 📊 Data Flow Patterns

### Portfolio Creation Flow

```
User Action (Create Portfolio)
  │
  ├─▶ Frontend: PortfolioConstructor Component
  │   ├─▶ User edits portfolio content
  │   ├─▶ Auto-save (via useAutoSave hook)
  │   └─▶ Manual save
  │
  ├─▶ API Call: POST /api/portfolio
  │   └─▶ portfolioAPI.createPortfolio(data)
  │
  ├─▶ Backend: Portfolio Creation Endpoint
  │   ├─▶ Validate authentication
  │   ├─▶ Validate portfolio data
  │   ├─▶ Set owner (from JWT)
  │   └─▶ Save to MongoDB
  │
  └─▶ Response: Portfolio Object
      └─▶ Frontend updates UI
```

### University Dashboard Flow

```
University User Accesses Dashboard
  │
  ├─▶ Frontend: UniversityPanel Component
  │   ├─▶ Load filters (search, date, verification, ILS)
  │   └─▶ Fetch portfolios
  │
  ├─▶ API Call: GET /api/portfolios
  │   ├─▶ Query parameters: filters, pagination
  │   └─▶ portfolioAPI.getPortfolios(filters)
  │
  ├─▶ Backend: Portfolios Endpoint
  │   ├─▶ Verify university role
  │   ├─▶ Query MongoDB with filters
  │   ├─▶ Apply pagination
  │   ├─▶ Mask personal data (contact-masking.js)
  │   └─▶ Return filtered, masked results
  │
  └─▶ Frontend: Display Results
      ├─▶ PortfolioGrid (card view)
      └─▶ PortfolioTable (table view)
```

---

## 🔄 Real-Time Features

### Socket.io Architecture

**Connection**:
- Frontend connects to backend Socket.io server
- Authentication via JWT token in connection auth
- Server validates token and joins user to rooms

**Rooms**:
- Olympiad rooms: `olympiad-${olympiadId}`
- Users join when starting olympiad
- Users leave when finishing or disconnecting

**Events**:
- **Timer Updates**: Broadcast every second to olympiad room
- **Leaderboard Updates**: Broadcast when submissions change
- **Submission Notifications**: Notify when user submits

**Implementation**:
```javascript
// Frontend
socket.on('timer-update', (data) => {
  setTimeRemaining(data.timeRemaining);
});

// Backend
io.to(`olympiad-${olympiadId}`).emit('timer-update', {
  timeRemaining: remainingTime
});
```

---

## 📁 File Organization

### Frontend Structure

**Components**: Reusable UI components
- **Portfolio**: Portfolio display components
- **PortfolioConstructor**: Portfolio editing components
- **PortfolioEditor**: Rich text editing components
- **PortfolioGrid/Table**: University dashboard views

**Pages**: Route components
- One component per route
- May use multiple child components
- Handle page-level state and data fetching

**Context**: Global state management
- Authentication state
- Socket connection
- Theme preferences
- Translations

**Services**: External communication
- API client (Axios)
- Socket.io client
- Portfolio-specific API calls

**Utils**: Helper functions
- Constants and configuration
- Data transformation
- Validation functions

### Backend Structure

**API Routes**: Endpoint handlers
- Organized by feature (auth, portfolio, admin)
- File-based routing
- Handle HTTP methods (GET, POST, PUT, DELETE)

**Models**: Database schemas
- Mongoose schemas
- Define data structure and validation
- Model methods for business logic

**Lib**: Utility libraries
- Authentication utilities
- Database connection
- Business logic helpers
- File upload handling

**Middleware**: Request processing
- Authentication middleware
- CORS middleware
- Error handling

---

## 🚀 Deployment Architecture

### Production Setup

```
Internet
  │
  ├─▶ Domain (unistem.example.com)
  │   │
  │   └─▶ Nginx Reverse Proxy
  │       ├─▶ Frontend (Static Files)
  │       │   └─▶ / → dist/ (React build)
  │       │
  │       └─▶ Backend API
  │           ├─▶ /api → Node.js Backend (PM2)
  │           └─▶ /socket.io → Socket.io Server
  │
  └─▶ Backend Server
      ├─▶ Node.js Process (PM2)
      ├─▶ Next.js API Routes
      ├─▶ Socket.io Server
      │
      └─▶ MongoDB
          └─▶ Database: olympiad-platform
              ├─▶ Collections (users, portfolios, etc.)
              └─▶ Indexes (for performance)
```

### Scaling Considerations

**Current Architecture** (Single Server):
- Frontend: Static files served by Nginx
- Backend: Node.js process with PM2
- Database: MongoDB (local or Atlas)
- File Storage: Local filesystem

**Future Scaling Options**:
1. **Horizontal Scaling**: Multiple backend instances behind load balancer
2. **Database Scaling**: MongoDB replica sets or sharding
3. **File Storage**: Object storage (S3, Azure Blob)
4. **Caching**: Redis for session storage and caching
5. **CDN**: CloudFront/Cloudflare for static assets

---

## 🔍 Monitoring & Observability

### Current Monitoring

**Application Logs**:
- PM2 logs for backend
- Browser console for frontend
- Server terminal output

**Health Checks**:
- `GET /api/health` endpoint
- Returns server status

### Recommended Monitoring

**Application Performance**:
- Response times
- Error rates
- Request throughput

**Infrastructure**:
- Server CPU/Memory
- Database performance
- Disk space

**Business Metrics**:
- User registrations
- Olympiad submissions
- Portfolio views

---

## 📝 Key Design Decisions

### Why Next.js for API Routes?

- **File-based routing**: Easy to organize endpoints
- **Built-in optimizations**: Automatic code splitting
- **TypeScript support**: Type safety (if needed)
- **Mature ecosystem**: Well-documented and supported

### Why Context API over Redux?

- **Simplicity**: Less boilerplate for this project size
- **Built-in**: No additional dependencies
- **Sufficient**: State complexity doesn't require Redux
- **Performance**: Adequate for current use case

### Why MongoDB?

- **Flexible schema**: Portfolios have varying structures
- **JSON-like documents**: Natural fit for React state
- **Easy to scale**: Horizontal scaling options
- **Rich querying**: Aggregation pipelines for complex queries

---

**Last Updated**: December 2024  
**Version**: 1.0

