# MongoDB Setup Guide for Windows

## Option 1: Install MongoDB Locally (Recommended for Development)

### Step 1: Download MongoDB Community Server

1. Go to: https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: Latest (7.0 or newer)
   - **Platform**: Windows
   - **Package**: MSI
3. Click **Download**

### Step 2: Install MongoDB

1. Run the downloaded `.msi` file
2. Choose **Complete** installation
3. **Important**: Check "Install MongoDB as a Service"
4. Select "Run service as Network Service user"
5. Check "Install MongoDB Compass" (optional but helpful)
6. Click **Install**

### Step 3: Verify Installation

Open PowerShell or Command Prompt and run:

```powershell
# Check if MongoDB service is running
sc query MongoDB

# Or check if mongod is available
mongod --version
```

### Step 4: Start MongoDB Service

If MongoDB service is installed but not running:

```powershell
# Start MongoDB service
net start MongoDB
```

### Step 5: Test Connection

1. Open MongoDB Compass
2. Connect to: `mongodb://127.0.0.1:27017`
3. You should see your databases

---

## Option 2: Use MongoDB Atlas (Cloud - Easier Setup)

If you prefer not to install MongoDB locally, use the free cloud version:

### Step 1: Create Free Account

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up (free tier available)

### Step 2: Create Cluster

1. Click **"Build a Database"**
2. Choose **FREE (M0)**
3. Select region closest to you
4. Click **Create**

### Step 3: Setup Access

1. **Create Database User:**

   - Username: `olympiaduser`
   - Password: Create a strong password (SAVE IT!)
   - Click **Create Database User**

2. **Network Access:**
   - Click **"Add My Current IP Address"** OR
   - For development: **"Allow Access from Anywhere"** (`0.0.0.0/0`)
   - Click **Finish and Close**

### Step 4: Get Connection String

1. Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Copy the connection string (looks like):
   ```
   mongodb+srv://olympiaduser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 5: Update .env File

Create a `.env` file in the project root (if it doesn't exist) and add:

```env
MONGODB_URI=mongodb+srv://olympiaduser:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/olympiad-platform?retryWrites=true&w=majority
```

**Important:**

- Replace `YOUR_PASSWORD` with your actual password
- Replace `cluster0.xxxxx` with your cluster address
- Add `/olympiad-platform` before the `?` (database name)

### Step 6: Restart Your Server

```powershell
# Stop server (Ctrl+C if running)
# Then restart:
npm run dev
```

---

## Troubleshooting Local MongoDB

### Check if MongoDB Service Exists

```powershell
sc query MongoDB
```

### Start MongoDB Service

```powershell
net start MongoDB
```

### Stop MongoDB Service

```powershell
net stop MongoDB
```

### Check if Port 27017 is in Use

```powershell
netstat -an | findstr 27017
```

### Manual Start (if service doesn't work)

```powershell
# Navigate to MongoDB bin directory (usually):
cd "C:\Program Files\MongoDB\Server\7.0\bin"

# Start MongoDB manually:
mongod --dbpath "C:\data\db"
```

**Note:** You may need to create the `C:\data\db` directory first:

```powershell
mkdir C:\data\db
```

---

## Quick Test

After setup, test the connection:

1. **Using MongoDB Compass:**

   - Connect to: `mongodb://127.0.0.1:27017`
   - Should connect successfully

2. **Using Your Backend:**
   - Start your server: `npm run dev`
   - Check console for: `✅ MongoDB Connected: 127.0.0.1`

---

## Recommendation

For **development**, I recommend:

- **Local MongoDB** if you want offline development and faster performance
- **MongoDB Atlas** if you want easy setup and don't mind cloud dependency

For **production**, use **MongoDB Atlas** or a managed MongoDB service.
