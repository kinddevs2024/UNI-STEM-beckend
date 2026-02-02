# MongoDB Connection Fix (2 minutes)

**Error:** `connect ECONNREFUSED 127.0.0.1:27017`

## Fastest fix: MongoDB Atlas (free cloud)

1. **Sign up:** [cloud.mongodb.com](https://cloud.mongodb.com) → Create free account

2. **Create cluster:** "Build a Database" → M0 FREE → Create

3. **Create user:** Security → Database Access → Add New User
   - Username: `unistem`
   - Password: (create one, save it)
   - Add user

4. **Network access:** Security → Network Access → Add IP Address
   - Add `0.0.0.0/0` (allow from anywhere)
   - Confirm

5. **Get connection string:** Database → Connect → Drivers → Copy connection string
   - Replace `<password>` with your actual password
   - Example: `mongodb+srv://unistem:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

6. **Update `.env`** in `UNI-STEM-beckend`:
   ```
   MONGODB_URI=mongodb+srv://unistem:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/unistem?retryWrites=true&w=majority
   ```
   (Add `/unistem` before `?` for database name)

7. **Restart backend:** Stop (`Ctrl+C`) and run `npm run dev` again

8. **MongoDB Compass:** Use the same connection string in Compass → New Connection → Paste URI → Connect
