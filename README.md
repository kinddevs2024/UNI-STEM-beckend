# Global Olympiad Backend

A modern backend API for the Global Olympiad platform built with **Next.js 14**, MongoDB, and Socket.io.

## Features

- 🔐 **JWT Authentication** - Secure user authentication and authorization
- 📝 **CRUD Operations** - Full CRUD for Olympiads, Questions, Users
- 📊 **Results & Leaderboard** - Real-time results and leaderboard management
- 📹 **Camera/Screen Capture** - Proctoring image storage
- 🔔 **Real-time Updates** - Socket.io for live updates
- 👥 **Role-based Access Control** - Student, Admin, Owner roles
- 📁 **File Upload** - Image upload handling for proctoring

## Tech Stack

- **Framework**: Next.js 14 (API Routes)
- **Runtime**: Node.js 18+
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Formidable

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Create `.env` file:**
```bash
cp .env.example .env
```

3. **Configure environment variables:**
Edit `.env` and update:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - A secure random string for JWT signing
- `PORT` - Server port (default: 3000)
- `FRONTEND_URL` - Your frontend URL for CORS

4. **Start the development server:**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Olympiads
- `GET /api/olympiads` - Get all published olympiads
- `GET /api/olympiads/:id` - Get single olympiad
- `POST /api/olympiads/:id/submit` - Submit answers (Protected)
- `GET /api/olympiads/:id/results` - Get results/leaderboard
- `POST /api/olympiads/camera-capture` - Upload camera/screen capture (Protected)

### Admin Routes (Protected/Admin)
- `GET /api/admin/olympiads` - Get all olympiads
- `POST /api/admin/olympiads` - Create olympiad
- `GET /api/admin/olympiads/:id` - Get olympiad
- `PUT /api/admin/olympiads/:id` - Update olympiad
- `DELETE /api/admin/olympiads/:id` - Delete olympiad
- `GET /api/admin/questions` - Get all questions
- `POST /api/admin/questions` - Create question
- `GET /api/admin/users` - Get all users
- `GET /api/admin/submissions` - Get all submissions
- `GET /api/admin/camera-captures/:olympiadId` - Get camera captures

### Owner Routes (Protected/Owner)
- `GET /api/owner/analytics` - Get platform analytics
- `GET /api/owner/reports` - Get reports
- `GET /api/owner/reports?olympiadId=:id` - Get detailed olympiad report
- `PUT /api/owner/users/:id/role` - Update user role

### Health Check
- `GET /api/health` - Server health check

## User Roles

- **student** - Can participate in olympiads
- **admin** - Can manage olympiads and questions
- **owner** - Full access including user management and analytics

## Socket.io Events

- `join-olympiad` - Join an olympiad room
- `leave-olympiad` - Leave an olympiad room
- `timer-update` - Broadcast timer updates
- `leaderboard-update` - Broadcast leaderboard updates
- `submission` - Broadcast submission notifications

## Project Structure

```
backend/
├── lib/
│   ├── auth.js          # Authentication utilities
│   ├── mongodb.js       # MongoDB connection
│   └── upload.js        # File upload utilities
├── models/
│   ├── User.js          # User model
│   ├── Olympiad.js      # Olympiad model
│   ├── Question.js      # Question model
│   ├── Result.js        # Result model
│   ├── Submission.js    # Submission model
│   └── CameraCapture.js # Camera capture model
├── pages/
│   └── api/
│       ├── auth/        # Authentication routes
│       ├── olympiads/   # Olympiad routes
│       ├── admin/       # Admin routes
│       └── owner/       # Owner routes
├── middleware/
│   └── auth.js          # Auth middleware
├── server.js            # Custom server with Socket.io
└── next.config.js       # Next.js configuration
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT
