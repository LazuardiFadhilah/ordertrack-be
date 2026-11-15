import { Router } from 'express';

const router = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OrderTrack API Specification',
    version: '1.0.0',
    description: 'API documentation for OrderTrack backend service shipped on Vercel Serverless.'
  },
  servers: [
    {
      url: 'https://ordertrack-be.vercel.app',
      description: 'Production Server'
    },
    {
      url: 'https://ordertrack-fe.vercel.app',
      description: 'Production Frontend Rewrite Proxy'
    },
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server'
    }
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health Check',
        responses: {
          '200': {
            description: 'Server and Database Status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        dbState: { type: 'number', example: 1 },
                        timestamp: { type: 'string', example: '2026-11-15T00:00:00.000Z' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'User Login',
        description: 'Authenticates user credentials and sets HttpOnly session cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@example.test' },
                  password: { type: 'string', example: 'Password123!' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful. Cookie headers set.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            role: { type: 'string', example: 'ADMIN' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Validation Error' },
          '401': { description: 'Invalid Email or Password' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Get Authenticated User Profile',
        description: 'Returns profile of current user based on HttpOnly cookie.',
        responses: {
          '200': { description: 'Authenticated profile' },
          '401': { description: 'Unauthorized / Cookie Missing or Expired' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        summary: 'User Logout',
        description: 'Clears the HttpOnly session cookie.',
        responses: {
          '200': { description: 'Logout successful' }
        }
      }
    }
  }
};

router.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

router.get('/', (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OrderTrack API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ]
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
