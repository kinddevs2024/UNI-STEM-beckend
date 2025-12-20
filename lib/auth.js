import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { connectDB } from './json-db.js';
import { findUserByIdWithoutPassword } from './user-helper.js';

// Ensure environment variables are loaded
// Next.js automatically loads .env files, but we ensure it's loaded here too
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
const cwdEnvPath = path.join(process.cwd(), '.env');

// Try to load .env file from multiple locations
// Load in order: project root (cwd), relative to this file, default location
const envPaths = [cwdEnvPath, envPath];
for (const envFilePath of envPaths) {
  try {
    if (existsSync(envFilePath)) {
      const result = dotenv.config({ path: envFilePath, override: true });
      if (result.parsed && result.parsed.JWT_SECRET) {
        process.env.JWT_SECRET = result.parsed.JWT_SECRET;
        break; // Stop if we found it
      }
      if (process.env.JWT_SECRET) break; // Stop if we found it
    }
  } catch (error) {
    // Continue to next path
  }
}

// Also try default location (project root) as fallback
if (!process.env.JWT_SECRET) {
  try {
    const result = dotenv.config({ override: true });
    if (result.parsed && result.parsed.JWT_SECRET) {
      process.env.JWT_SECRET = result.parsed.JWT_SECRET;
    }
  } catch (error) {
    // Ignore
  }
}

// Helper function to read JWT_SECRET from .env file directly
function getJWTSecret() {
  // First try process.env (Next.js should load it automatically)
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  // If not available, try to load .env file from multiple locations
  const possibleEnvPaths = [
    envPath,
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
  ];
  
  for (const envFilePath of possibleEnvPaths) {
    try {
      const result = dotenv.config({ path: envFilePath, override: false });
      if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
      }
    } catch (e) {
      // Continue to next path
      continue;
    }
  }
  
  // Try default dotenv.config() as last resort
  try {
    dotenv.config({ override: false });
    if (process.env.JWT_SECRET) {
      return process.env.JWT_SECRET;
    }
  } catch (e) {
    // Ignore
  }
  
  // Last resort: read .env file directly and parse it manually
  try {
    // Try multiple possible .env file locations
    const possiblePaths = [
      cwdEnvPath,
      envPath,
      path.join(process.cwd(), '.env.local'),
      path.join(__dirname, '..', '.env.local'),
    ];
    
    for (const envFilePath of possiblePaths) {
      if (existsSync(envFilePath)) {
        const envContent = readFileSync(envFilePath, 'utf8');
        // Handle both Unix (\n) and Windows (\r\n) line endings
        const lines = envContent.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          // Skip empty lines and comments
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;
          
          // Match JWT_SECRET=value pattern (handles spaces, quotes, comments)
          if (trimmedLine.startsWith('JWT_SECRET=')) {
            let value = trimmedLine.substring('JWT_SECRET='.length).trim();
            // Handle comments
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
              value = value.substring(0, commentIndex).trim();
            }
            // Remove surrounding quotes if present (single or double)
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            // Handle multi-line values (if next line doesn't have = and is hex chars)
            if (value && i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !nextLine.includes('=') && !nextLine.startsWith('#') && /^[a-fA-F0-9]+$/.test(nextLine)) {
                value += nextLine;
              }
            }
            if (value) {
              return value;
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return null;
}

export const generateToken = (id) => {
  const secret = getJWTSecret();
  
  if (!secret) {
    console.error('❌ JWT_SECRET is missing. Check your .env file at:', envPath);
    throw new Error('JWT_SECRET is not defined in environment variables. Please check your .env file and restart the server.');
  }
  
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

export const verifyToken = (token) => {
  try {
    const secret = getJWTSecret();
    if (!secret) {
      return null;
    }
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

export const protect = async (req) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return { error: 'Not authorized, no token', status: 401 };
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return { error: 'Not authorized, token failed', status: 401 };
    }

    await connectDB();
    const user = findUserByIdWithoutPassword(decoded.id);

    if (!user) {
      return { error: 'User not found', status: 401 };
    }

    return { user };
  } catch (error) {
    return { error: 'Not authorized, token failed', status: 401 };
  }
};

export const authorize = (...roles) => {
  return (user) => {
    if (!roles.includes(user.role)) {
      // Special message for students
      if (user.role === 'student') {
        return {
          error: "we are working on the results",
          status: 403,
        };
      }
      return {
        error: `User role '${user.role}' is not authorized to access this route`,
        status: 403,
      };
    }
    return null;
  };
};
