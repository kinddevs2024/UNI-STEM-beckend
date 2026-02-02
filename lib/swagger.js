import swaggerJsdoc from 'swagger-jsdoc';
import { networkInterfaces } from 'os';

// Function to get local IP address
const getLocalIP = () => {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const port = parseInt(process.env.PORT || '3000', 10);
const localIP = getLocalIP();

const getSwaggerOptions = () => ({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UNI STEM API',
      version: '1.0.0',
      description: 'Backend API for UNI STEM platform',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${port}/api`,
        description: 'Local server (localhost)',
      },
      {
        url: `http://${localIP}:${port}/api`,
        description: 'Network server (accessible from other devices)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['student', 'admin', 'owner', 'resolter', 'school-admin', 'school-teacher'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Olympiad: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['test', 'essay', 'mixed'],
            },
            subject: {
              type: 'string',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
            },
            duration: {
              type: 'number',
              description: 'Duration in seconds',
            },
            status: {
              type: 'string',
              enum: ['draft', 'unvisible', 'visible', 'published', 'upcoming', 'active', 'completed'],
            },
            questions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Question',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Question: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            question: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['multiple-choice', 'essay'],
            },
            options: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            correctAnswer: {
              type: 'string',
            },
            points: {
              type: 'number',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
            },
            error: {
              type: 'string',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./pages/api/**/*.js'], // Path to the API files
});

export const getSwaggerSpec = () => swaggerJsdoc(getSwaggerOptions());
export const swaggerSpec = getSwaggerSpec();

