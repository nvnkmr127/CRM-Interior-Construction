const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Interior & Construction CRM API',
      version: '1.0.0',
      description: 'API documentation for the DigiCloudify CRM.',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
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
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './server/src/routes/*.js'],
};

let swaggerSpec = null;

const setupSwagger = (app) => {
  if (process.env.VERCEL) return; // Skip heavy filesystem scans on Vercel cold-start
  app.use('/api-docs', (req, res, next) => {
    if (!swaggerSpec) {
      try {
        swaggerSpec = swaggerJsDoc(options);
      } catch (error) {
        swaggerSpec = {};
      }
    }
    next();
  }, swaggerUi.serve, (req, res, next) => swaggerUi.setup(swaggerSpec)(req, res, next));
};

module.exports = setupSwagger;
