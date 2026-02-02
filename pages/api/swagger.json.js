import { getSwaggerSpec } from '../../lib/swagger.js';
import { networkInterfaces } from 'os';

import { handleCORS } from '../../lib/api-helpers.js';

// Function to get local IP address
const getLocalIP = () => {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

export default function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method === 'GET') {
    // Get the hostname from the request
    const host = req.headers.host || `localhost:${process.env.PORT || 3000}`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const port = parseInt(process.env.PORT || '3000', 10);
    const localIP = getLocalIP();
    
    // Determine if request is from localhost or network
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const baseUrl = isLocalhost 
      ? `http://localhost:${port}/api`
      : `${protocol}://${host.split(':')[0]}:${port}/api`;
    
    // Get the base swagger spec
    const baseSpec = getSwaggerSpec();
    
    // Update servers dynamically based on request origin
    const dynamicSpec = {
      ...baseSpec,
      servers: [
        {
          url: baseUrl,
          description: isLocalhost ? 'Local server' : 'Network server',
        },
        {
          url: `http://localhost:${port}/api`,
          description: 'Local server (localhost)',
        },
        {
          url: `http://${localIP}:${port}/api`,
          description: 'Network server (accessible from other devices)',
        },
      ],
    };
    
    // Set CORS headers for network access
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).json(dynamicSpec);
  } else if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

