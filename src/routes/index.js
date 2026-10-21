import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import surveyRoutes, { publicSurveyRouter } from '../modules/surveys/survey.routes.js';
import responseRoutes from '../modules/responses/response.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import metaRoutes from './meta.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: Date.now() });
});

router.use('/_meta', metaRoutes);
router.use('/auth', authRoutes);
router.use('/', publicSurveyRouter);
router.use('/surveys', surveyRoutes);
router.use('/', responseRoutes);
router.use('/', analyticsRoutes);

export default router;
