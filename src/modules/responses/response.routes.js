import { Router } from 'express';
import { protect, optionalAuth } from '../../common/middlewares/auth.js';
import { requireSurveyOwner } from '../../common/middlewares/ownership.js';
import * as ctrl from './response.controller.js';

const router = Router();

router.post('/surveys/:id/responses', optionalAuth, ctrl.submitResponse);
router.get('/surveys/:id/responses', protect, requireSurveyOwner, ctrl.listSurveyResponses);

export default router;
