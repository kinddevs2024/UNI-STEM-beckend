# MongoDB Setup for Global Olympiad

The backend requires MongoDB. Connection error `ECONNREFUSED 127.0.0.1:27017` means MongoDB is not running.

## Option A: MongoDB Atlas (Cloud – recommended, no install)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Create a database user (username + password)
4. In Network Access, add `0.0.0.0/0` (or your IP)
5. Copy the connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/global-olympiad`)
6. In `.env` set:
   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/global-olympiad
   ```
7. Restart the backend

## Option B: Local MongoDB (127.0.0.1:27017)

### Install MongoDB on Windows

1. Download: [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Run the installer (choose "Complete")
3. Optionally install as a Windows service so it starts automatically

### Start MongoDB

**If installed as a service:**
```powershell
Start-Service MongoDB
```

**If running manually:**
```powershell
# Default path after install:
& "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath="C:\data\db"
```

(Use your actual MongoDB version path. Create `C:\data\db` if it does not exist.)

### Verify

```powershell
mongosh
# or
mongo
```

Your `.env` already uses `mongodb://127.0.0.1:27017/olympiad-platform`.
