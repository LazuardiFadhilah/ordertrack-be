import { Router } from 'express';

const router = Router();

router.get('/health', (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      service: 'server',
      status: 'ok',
    },
  });
});

export default router;
