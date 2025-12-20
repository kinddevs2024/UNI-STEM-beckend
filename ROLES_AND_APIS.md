# Roles and APIs Documentation

## User Roles

The system supports **8 different user roles** with varying levels of access:

### 1. **student** (Default Role)
**Capabilities:**
- Participate in olympiads
- Submit answers to olympiad questions
- View own results and leaderboard
- Create and manage portfolios
- Save drafts during olympiad
- Upload profile logo
- Can have school information (schoolName, schoolId)

**APIs Available:**
- `POST /api/auth/register` - Register account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update own profile
- `POST /api/auth/upload-logo` - Upload profile picture
- `GET /api/olympiads` - View published olympiads
- `GET /api/olympiads/:id` - View olympiad details
- `POST /api/olympiads/:id/submit` - Submit answers
- `GET /api/olympiads/:id/results` - View own results
- `GET /api/olympiads/:id/leaderboard` - View leaderboard
- `POST /api/olympiads/:id/save-draft` - Save draft answers
- `GET /api/olympiads/:id/get-draft` - Get saved draft
- `POST /api/olympiads/camera-capture` - Upload camera/screen capture
- `POST /api/olympiads/upload-screenshot` - Upload screenshot
- `POST /api/olympiads/upload-video` - Upload video
- `POST /api/portfolio` - Create portfolio
- `GET /api/portfolio/my` - Get own portfolios
- `GET /api/portfolio/:id` - Get portfolio details
- `PUT /api/portfolio/:id` - Update portfolio
- `POST /api/portfolio/:id/publish` - Publish portfolio
- `POST /api/portfolio/:id/unpublish` - Unpublish portfolio
- `POST /api/portfolio/:id/reserve` - Reserve portfolio for university
- `GET /api/portfolio/my-reservations` - Get own reservations
- `POST /api/portfolio/:id/block` - Add portfolio block
- `PUT /api/portfolio/:id/block/:blockId` - Update block
- `DELETE /api/portfolio/:id/block/:blockId` - Delete block
- `POST /api/portfolio/:id/block/:blockId/verify-request` - Request verification
- `POST /api/upload/certificates` - Upload certificates

---

### 2. **admin**
**Capabilities:**
- All student capabilities
- Manage olympiads (create, update, delete)
- Manage questions
- View all users
- View all submissions
- View camera captures
- Start/finish olympiads
- Manage olympiad status
- Approve/reject portfolio verifications
- Recalculate portfolio ratings

**APIs Available:**
- All student APIs
- `GET /api/admin/olympiads` - Get all olympiads
- `POST /api/admin/olympiads` - Create olympiad
- `GET /api/admin/olympiads/:id` - Get olympiad
- `PUT /api/admin/olympiads/:id` - Update olympiad
- `DELETE /api/admin/olympiads/:id` - Delete olympiad
- `POST /api/admin/olympiads/:id/start` - Start olympiad
- `POST /api/admin/olympiads/:id/finish` - Finish olympiad
- `PUT /api/admin/olympiads/:id/status` - Update olympiad status
- `GET /api/admin/olympiads/:id/questions` - Get olympiad questions
- `POST /api/admin/olympiads/upload-logo` - Upload olympiad logo
- `GET /api/admin/questions` - Get all questions
- `POST /api/admin/questions` - Create question
- `GET /api/admin/users` - Get all users
- `GET /api/admin/submissions` - Get all submissions
- `GET /api/admin/camera-captures/:olympiadId` - Get camera captures
- `GET /api/verification/pending` - Get pending verifications
- `POST /api/verification/:blockId/approve` - Approve verification
- `POST /api/verification/:blockId/reject` - Reject verification
- `GET /api/verification/:blockId/history` - Get verification history
- `POST /api/portfolio/:id/recalculate-rating` - Recalculate rating

---

### 3. **owner**
**Capabilities:**
- All admin capabilities
- Full platform access
- Manage user roles
- View platform analytics
- Generate reports
- Update any user's role

**APIs Available:**
- All admin APIs
- `GET /api/owner/analytics` - Get platform analytics
- `GET /api/owner/reports` - Get reports
- `GET /api/owner/reports?olympiadId=:id` - Get detailed olympiad report
- `PUT /api/owner/users/:id/role` - Update user role (can set any role)

---

### 4. **resolter**
**Capabilities:**
- Grade submissions manually
- Edit result scores and percentages
- Change result status (active, blocked, pending, under-review, checked)
- Change result visibility
- View all results
- View all submissions

**APIs Available:**
- `GET /api/resolter/results` - Get all results
- `GET /api/resolter/all-results` - Get all results (detailed)
- `PUT /api/resolter/results/:id/edit` - Edit result scores
- `PUT /api/resolter/results/:id/status` - Change result status
- `PUT /api/resolter/results/:id/visibility` - Change result visibility
- `GET /api/admin/submissions` - Get all submissions
- `POST /api/resolter/submissions/:id/grade` - Grade submission manually

---

### 5. **school-teacher**
**Capabilities:**
- View results for students from their school only
- View camera captures for their school's students
- Must have schoolName or schoolId assigned
- Can have school information (schoolName, schoolId)

**APIs Available:**
- `GET /api/school-teacher/results?olympiadId=:id` - Get school's student results
- `GET /api/school-teacher/camera-captures?olympiadId=:id` - Get school's camera captures
- `GET /api/admin/camera-captures/:olympiadId` - Get camera captures (also accessible)

---

### 6. **school-admin**
**Capabilities:**
- Similar to school-teacher but with broader school management
- Can have school information (schoolName, schoolId)

**APIs Available:**
- Similar to school-teacher (implementation may vary)

---

### 7. **university**
**Capabilities:**
- Browse and view portfolios
- Reserve portfolios for recruitment
- View portfolio ratings
- Access masked contact information
- Filter portfolios by verification status, rating, ILS level

**APIs Available:**
- `GET /api/portfolios` - List all portfolios (with filters)
- `GET /api/ratings/global` - Get global portfolio ratings
- `POST /api/portfolio/:id/reserve` - Reserve portfolio
- `GET /api/portfolio/:id` - View portfolio details (with masked contacts)
- `GET /api/analytics/view` - View analytics

---

### 8. **checker**
**Capabilities:**
- Verify portfolios
- Approve/reject portfolio verifications
- View portfolios
- View global ratings

**APIs Available:**
- `GET /api/portfolios` - List portfolios
- `GET /api/ratings/global` - Get global ratings
- `POST /api/portfolio/:id/verify` - Verify portfolio
- `POST /api/portfolio/:id/reject` - Reject portfolio
- `GET /api/verification/pending` - Get pending verifications (if admin access)

---

## Complete API Endpoints List

### Authentication APIs
- `POST /api/auth/register` - Register new user (Public)
- `POST /api/auth/login` - Login user (Public)
- `GET /api/auth/me` - Get current user (Protected)
- `PUT /api/auth/profile` - Update profile (Protected)
- `POST /api/auth/upload-logo` - Upload profile logo (Protected)
- `POST /api/auth/cookie-consent` - Cookie consent (Protected)

### Olympiad APIs (Public/Protected)
- `GET /api/olympiads` - Get all published olympiads (Public)
- `GET /api/olympiads/:id` - Get single olympiad (Public)
- `POST /api/olympiads/:id/submit` - Submit answers (Protected - Student)
- `GET /api/olympiads/:id/results` - Get results/leaderboard (Protected)
- `GET /api/olympiads/:id/leaderboard` - Get leaderboard (Protected)
- `POST /api/olympiads/:id/save-draft` - Save draft (Protected - Student)
- `GET /api/olympiads/:id/get-draft` - Get draft (Protected - Student)
- `POST /api/olympiads/camera-capture` - Upload camera capture (Protected - Student)
- `POST /api/olympiads/camera-capture/finalize` - Finalize capture (Protected - Student)
- `POST /api/olympiads/upload-screenshot` - Upload screenshot (Protected - Student)
- `POST /api/olympiads/upload-video` - Upload video (Protected - Student)
- `GET /api/olympiads/results` - Get all results (Protected)

### Admin APIs (Protected - Admin/Owner)
- `GET /api/admin/olympiads` - Get all olympiads
- `POST /api/admin/olympiads` - Create olympiad
- `GET /api/admin/olympiads/:id` - Get olympiad
- `PUT /api/admin/olympiads/:id` - Update olympiad
- `DELETE /api/admin/olympiads/:id` - Delete olympiad
- `POST /api/admin/olympiads/:id/start` - Start olympiad
- `POST /api/admin/olympiads/:id/finish` - Finish olympiad
- `PUT /api/admin/olympiads/:id/status` - Update status
- `GET /api/admin/olympiads/:id/questions` - Get questions
- `POST /api/admin/olympiads/upload-logo` - Upload logo
- `GET /api/admin/questions` - Get all questions
- `POST /api/admin/questions` - Create question
- `GET /api/admin/users` - Get all users
- `GET /api/admin/submissions` - Get all submissions
- `GET /api/admin/camera-captures/:olympiadId` - Get camera captures

### Owner APIs (Protected - Owner Only)
- `GET /api/owner/analytics` - Get platform analytics
- `GET /api/owner/reports` - Get reports
- `GET /api/owner/reports?olympiadId=:id` - Get detailed report
- `PUT /api/owner/users/:id/role` - Update user role

### Resolter APIs (Protected - Resolter/Admin/Owner)
- `GET /api/resolter/results` - Get all results
- `GET /api/resolter/all-results` - Get all results (detailed)
- `PUT /api/resolter/results/:id/edit` - Edit result scores
- `PUT /api/resolter/results/:id/status` - Change status
- `PUT /api/resolter/results/:id/visibility` - Change visibility
- `POST /api/resolter/submissions/:id/grade` - Grade submission

### School Teacher APIs (Protected - School-Teacher)
- `GET /api/school-teacher/results?olympiadId=:id` - Get school results
- `GET /api/school-teacher/camera-captures?olympiadId=:id` - Get school captures

### Portfolio APIs
- `POST /api/portfolio` - Create portfolio (Protected - Student)
- `GET /api/portfolio/my` - Get own portfolios (Protected - Student)
- `GET /api/portfolio/:id` - Get portfolio (Protected)
- `PUT /api/portfolio/:id` - Update portfolio (Protected - Owner)
- `POST /api/portfolio/:id/publish` - Publish (Protected - Owner)
- `POST /api/portfolio/:id/unpublish` - Unpublish (Protected - Owner)
- `POST /api/portfolio/:id/reserve` - Reserve (Protected - University)
- `GET /api/portfolio/my-reservations` - Get reservations (Protected)
- `POST /api/portfolio/:id/verify` - Verify (Protected - Checker/Admin/Owner)
- `POST /api/portfolio/:id/reject` - Reject (Protected - Checker/Admin/Owner)
- `POST /api/portfolio/:id/recalculate-rating` - Recalculate (Protected - Admin/Owner)
- `PUT /api/portfolio/:id/reorder` - Reorder sections (Protected - Owner)
- `POST /api/portfolio/:id/block` - Add block (Protected - Owner)
- `PUT /api/portfolio/:id/block/:blockId` - Update block (Protected - Owner)
- `DELETE /api/portfolio/:id/block/:blockId` - Delete block (Protected - Owner)
- `POST /api/portfolio/:id/block/:blockId/verify-request` - Request verification (Protected - Owner)
- `PUT /api/portfolio/:id/:sectionId` - Update section (Protected - Owner)
- `POST /api/portfolio/generate-from-text` - Generate from text (Protected - Student)
- `GET /api/portfolios` - List portfolios (Protected - University/Checker/Admin/Owner)

### Verification APIs (Protected - Admin/Owner)
- `GET /api/verification/pending` - Get pending requests
- `POST /api/verification/:blockId/approve` - Approve verification
- `POST /api/verification/:blockId/reject` - Reject verification
- `GET /api/verification/:blockId/history` - Get history

### Upload APIs
- `POST /api/upload/certificates` - Upload certificates (Protected)
- `POST /api/upload/portfolio-logo` - Upload portfolio logo (Protected)
- `GET /api/uploads/[...path]` - Get uploaded files (Public)

### Rating APIs
- `GET /api/ratings/global` - Get global ratings (Protected - University/Checker/Admin/Owner)

### Analytics APIs
- `GET /api/analytics/view` - View analytics (Protected)

### Health & Documentation
- `GET /api/health` - Health check (Public)
- `GET /api/swagger.json` - Swagger JSON (Public)
- `GET /api-docs` - Swagger UI (Public)

---

## Role Hierarchy

```
owner (Highest)
  ├── Full platform control
  ├── User role management
  └── Analytics & Reports
    │
admin
  ├── Olympiad & Question management
  ├── Verification management
  └── User viewing
    │
resolter
  ├── Result editing & grading
  └── Submission management
    │
checker
  ├── Portfolio verification
  └── Portfolio viewing
    │
university
  ├── Portfolio browsing
  ├── Portfolio reservation
  └── Contact access (masked)
    │
school-admin / school-teacher
  ├── School-specific results
  └── School-specific camera captures
    │
student (Default)
  ├── Olympiad participation
  ├── Portfolio creation
  └── Basic profile management
```

---

## Notes

1. **School Information**: Only `student` and `school-teacher` roles can have `schoolName` and `schoolId` fields.

2. **Portfolio Access**: 
   - Students can create and manage their own portfolios
   - Universities can browse and reserve portfolios
   - Checkers can verify portfolios
   - Admins/Owners have full access

3. **Result Management**:
   - Students can view their own results
   - Resolters can edit and grade results
   - School-teachers can view their school's results
   - Admins/Owners can view all results

4. **Verification System**:
   - Students request verification for portfolio blocks
   - Checkers/Admins approve/reject verifications
   - Verification affects portfolio ratings

5. **Authentication**: Most endpoints require JWT token authentication via `Authorization: Bearer <token>` header.

