import { Router } from 'express';
import { protect } from '../../common/middlewares/auth.js';
import { requireSurveyOwner } from '../../common/middlewares/ownership.js';
import * as ctrl from './analytics.controller.js';

const router = Router();

router.get('/surveys/:id/analytics', protect, requireSurveyOwner, ctrl.getSurveyAnalytics);
router.get('/surveys/:id/questions/:qid/analytics', protect, requireSurveyOwner, ctrl.getQuestionAnalytics);

export default router;
