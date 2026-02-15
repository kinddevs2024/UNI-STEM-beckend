# Developer Guide

Welcome to Global Olympiad! This guide will help you get started as a new developer on the project.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **MongoDB**: Local installation or MongoDB Atlas account
- **Git**: For version control
- **Code Editor**: VS Code recommended (with React extensions)

### Initial Setup

1. **Clone the repository** (if applicable)

2. **Install Backend Dependencies**:
   ```bash
   cd UNI-STEM-beckend
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd UNI-STEM-Front
   npm install
   ```

4. **Configure Environment Variables**:
   - Backend: Create `.env` file in `UNI-STEM-beckend/`
   - Frontend: Create `.env` file in `UNI-STEM-Front/` (optional)
   - See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for details

5. **Start MongoDB** (if using local MongoDB):
   ```bash
   # Windows
   net start MongoDB
   # or use the provided script
   cd UNI-STEM-beckend
   .\start-mongodb.bat
   ```

6. **Start Backend**:
   ```bash
   cd UNI-STEM-beckend
   npm run dev
   ```
   Backend runs on `http://localhost:3000`

7. **Start Frontend**:
   ```bash
   cd UNI-STEM-Front
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

8. **Open Browser**:
   Navigate to `http://localhost:5173`

---

## 📁 Project Structure

### Frontend (`UNI-STEM-Front/`)

```
src/
├── components/          # Reusable React components
│   ├── Portfolio/      # Portfolio-related components
│   ├── PortfolioConstructor/  # Portfolio editor components
│   ├── PortfolioEditor/  # Portfolio editing UI
│   ├── PortfolioGrid/   # University dashboard grid view
│   ├── PortfolioTable/  # University dashboard table view
│   └── ...             # Other components
├── pages/              # Page components (routes)
│   ├── Dashboard/      # User dashboard
│   ├── AdminPanel/     # Admin interface
│   ├── UniversityPanel/  # University dashboard
│   ├── PortfolioView/  # Public portfolio view
│   └── ...            # Other pages
├── context/            # React Context providers
│   ├── AuthContext.jsx      # Authentication state
│   ├── SocketContext.jsx    # Socket.io connection
│   ├── ThemeContext.jsx     # Theme management
│   └── ...                 # Other contexts
├── services/           # API and service layers
│   ├── api.js         # Main API client (Axios)
│   ├── portfolioAPI.js  # Portfolio-specific API calls
│   └── socket.js      # Socket.io client
├── utils/              # Utility functions
│   ├── constants.js   # App constants and config
│   ├── helpers.js     # Helper functions
│   └── ...            # Other utilities
└── styles/             # Global styles
    ├── design-tokens.css  # Design system tokens
    ├── globals.css        # Global styles
    └── animations.css     # Animation definitions
```

### Backend (`UNI-STEM-beckend/`)

```
├── pages/api/          # API routes (Next.js API Routes)
│   ├── auth/          # Authentication endpoints
│   ├── olympiads/     # Olympiad endpoints
│   ├── portfolio/     # Portfolio endpoints
│   ├── admin/         # Admin endpoints
│   ├── owner/         # Owner endpoints
│   └── ...           # Other endpoints
├── models/            # MongoDB models (Mongoose)
│   ├── User.js       # User model
│   ├── Portfolio.js  # Portfolio model
│   ├── Olympiad.js   # Olympiad model
│   └── ...          # Other models
├── lib/              # Library/utility functions
│   ├── auth.js      # Authentication utilities
│   ├── mongodb.js   # MongoDB connection
│   ├── portfolio-helper.js  # Portfolio business logic
│   └── ...         # Other utilities
├── middleware/       # Express/Next.js middleware
│   ├── auth.js      # Authentication middleware
│   └── cors.js      # CORS configuration
└── server.js        # Custom server with Socket.io
```

---

## 🏗️ Architecture Overview

### Frontend Architecture

**Technology Stack**:
- **React 18.2.0** - UI library
- **Vite 7.2.6** - Build tool and dev server
- **React Router 6.20.0** - Client-side routing
- **Framer Motion 11.0.0** - Animations
- **Axios 1.6.2** - HTTP client
- **Socket.io Client 4.5.4** - Real-time communication

**Key Patterns**:
- **Context API**: State management (Auth, Socket, Theme)
- **Protected Routes**: Route-level authentication
- **API Service Layer**: Centralized API calls
- **Component Composition**: Reusable component patterns

### Backend Architecture

**Technology Stack**:
- **Next.js 14.0.4** - Framework (API Routes only)
- **Node.js 18+** - Runtime
- **MongoDB + Mongoose 8.0.3** - Database
- **Socket.io 4.5.4** - Real-time server
- **JWT** - Authentication

**Key Patterns**:
- **API Routes**: RESTful endpoints in `pages/api/`
- **Mongoose Models**: Database schema definitions
- **Middleware**: Authentication and CORS handling
- **Helper Libraries**: Business logic separation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

---

## 🔑 Key Concepts

### Authentication Flow

1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. Backend returns JWT token
3. Frontend stores token in localStorage
4. Token is included in `Authorization: Bearer <token>` header for API calls
5. Backend middleware (`middleware/auth.js`) validates token

### Role-Based Access Control

**User Roles**:
- **student** - Can participate in olympiads
- **admin** - Can manage olympiads and questions
- **owner** - Full platform access
- **university** - Can view portfolios (with masking)
- **checker** - Can verify portfolios
- **resolter** - Can resolve results
- **school-teacher** - Teacher-specific access

**Access Control**:
- Frontend: `ProtectedRoute` component checks authentication
- Backend: Middleware checks roles in JWT token
- API endpoints verify roles before allowing access

### Portfolio System

**Key Concepts**:
- **Multi-page portfolios** - Portfolios have multiple sections/pages
- **Theme system** - Light/dark themes with customizable container width
- **Public/Private** - Portfolios can be public (viewable without auth) or private
- **Verification** - Universities can verify portfolios

**Data Flow**:
1. User creates portfolio in `PortfolioConstructor`
2. Portfolio saved via `portfolioAPI.js`
3. Backend stores in MongoDB with `isPublic`/`visibility` flags
4. Public portfolios accessible via `/portfolio/:id` route
5. University dashboard shows portfolios with data masking

### Olympiad System

**Olympiad Types**:
- **Test** - Multiple choice questions
- **Essay** - Text-based answers

**Flow**:
1. Admin creates olympiad and questions
2. Olympiad published and becomes available to students
3. Student starts olympiad (timer begins)
4. Proctoring captures camera/screen
5. Student submits answers
6. System calculates results and updates leaderboard
7. Results visible to students and admins

---

## 🛠️ Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow existing code patterns
   - Write clean, readable code
   - Add comments for complex logic

3. **Test your changes**:
   - Test in browser (frontend changes)
   - Test API endpoints (backend changes)
   - Check for console errors

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

### Code Style Guidelines

**JavaScript/React**:
- Use ES6+ features (arrow functions, destructuring, etc.)
- Use functional components with hooks
- Keep components small and focused
- Use meaningful variable and function names
- Add PropTypes or TypeScript types (if applicable)

**CSS**:
- Use design tokens from `design-tokens.css`
- Follow BEM naming convention (if applicable)
- Keep styles modular and component-scoped
- Use CSS variables for theming

**API/Backend**:
- Follow RESTful conventions
- Return consistent response formats
- Handle errors gracefully
- Validate input data
- Use middleware for cross-cutting concerns

### Testing Your Changes

**Frontend Testing**:
- Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- Test responsive design (mobile, tablet, desktop)
- Test with different user roles
- Check console for errors/warnings

**Backend Testing**:
- Test API endpoints with Postman/curl
- Verify database operations
- Test error cases (invalid input, missing auth, etc.)
- Check server logs for errors

---

## 🔍 Finding Your Way Around

### Where to Find Things

**Adding a New Page**:
1. Create component in `src/pages/YourPage/YourPage.jsx`
2. Add route in `src/App.jsx`
3. Add navigation link (if needed) in `src/components/Navbar.jsx`

**Adding a New API Endpoint**:
1. Create file in `pages/api/your-endpoint/your-endpoint.js`
2. Use existing endpoints as templates
3. Add authentication middleware if needed
4. Document in API documentation

**Adding a New Database Model**:
1. Create model in `models/YourModel.js`
2. Define schema with Mongoose
3. Export model for use in API routes

**Styling Components**:
- Use design tokens from `styles/design-tokens.css`
- Follow existing component patterns
- Use CSS modules or component-scoped styles

### Common Tasks

**Adding Authentication to an Endpoint**:
```javascript
import { authenticate } from '../../../middleware/auth';

export default async function handler(req, res) {
  const user = await authenticate(req);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // Your endpoint logic here
}
```

**Making an API Call from Frontend**:
```javascript
import api from '../services/api';

// GET request
const response = await api.get('/api/your-endpoint');

// POST request
const response = await api.post('/api/your-endpoint', { data });
```

**Using Context in Component**:
```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated } = useAuth();
  // Use user and isAuthenticated
}
```

---

## 📚 Key Files to Understand

### Frontend

**Essential Files**:
- `src/App.jsx` - Main app component, routing
- `src/main.jsx` - Application entry point
- `src/context/AuthContext.jsx` - Authentication state
- `src/services/api.js` - API client configuration
- `src/utils/constants.js` - App constants and configuration

**Key Components**:
- `src/components/ProtectedRoute.jsx` - Route protection
- `src/pages/Dashboard/Dashboard.jsx` - Main dashboard
- `src/pages/PortfolioConstructor/PortfolioConstructor.jsx` - Portfolio editor

### Backend

**Essential Files**:
- `server.js` - Server entry point, Socket.io setup
- `lib/mongodb.js` - Database connection
- `lib/auth.js` - Authentication utilities
- `middleware/auth.js` - Authentication middleware

**Key Endpoints**:
- `pages/api/auth/` - Authentication endpoints
- `pages/api/portfolio/` - Portfolio endpoints
- `pages/api/admin/` - Admin endpoints

---

## 🐛 Debugging Tips

### Frontend Debugging

1. **Browser DevTools**:
   - Console tab for errors
   - Network tab for API calls
   - React DevTools for component state

2. **Common Issues**:
   - CORS errors: Check `FRONTEND_URL` in backend `.env`
   - Authentication errors: Check token in localStorage
   - API errors: Check Network tab for response details

### Backend Debugging

1. **Server Logs**:
   - Check terminal for server logs
   - Look for error messages and stack traces

2. **Common Issues**:
   - MongoDB connection: Check `MONGODB_URI` in `.env`
   - JWT errors: Verify `JWT_SECRET` is set
   - Port conflicts: Check if port 3000 is available

### Debugging Database

```bash
# Connect to MongoDB (if local)
mongo
# or
mongosh

# Use database
use olympiad-platform

# Query collections
db.users.find()
db.portfolios.find()
```

---

## 📖 Additional Resources

### Documentation

- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Production status
- [API_ENDPOINTS.md](./UNI-STEM-Front/docs/API_ENDPOINTS.md) - API documentation
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Environment variables
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Known issues and technical debt

### External Resources

- [React Documentation](https://react.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Socket.io Documentation](https://socket.io/docs/)

---

## ❓ Getting Help

### When You're Stuck

1. **Check Documentation**: Review relevant docs first
2. **Search Codebase**: Look for similar implementations
3. **Check Known Issues**: See if your issue is documented
4. **Ask the Team**: Reach out to senior developers

### Common Questions

**Q: How do I add a new user role?**  
A: Update role constants in `utils/constants.js`, update backend role checks, and update frontend role-based routing.

**Q: How do I add a new portfolio section type?**  
A: Add section component in `components/Portfolio/sections/`, register in portfolio editor, and update portfolio schema if needed.

**Q: How do I add a new API endpoint?**  
A: Create file in `pages/api/`, use existing endpoints as template, add authentication if needed, and document in API docs.

---

## ✅ Checklist for New Developers

- [ ] Environment set up and running
- [ ] Can start both frontend and backend
- [ ] Can create a test user account
- [ ] Understand authentication flow
- [ ] Familiar with project structure
- [ ] Know where to find key files
- [ ] Can make simple changes and test them
- [ ] Understand role-based access control
- [ ] Read API documentation
- [ ] Read production readiness documentation

---

**Welcome to the team! Happy coding! 🚀**

**Last Updated**: December 2024  
**Version**: 1.0

