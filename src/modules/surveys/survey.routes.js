import { Router } from 'express';
import { protect, optionalAuth } from '../../common/middlewares/auth.js';
import { requireSurveyOwner } from '../../common/middlewares/ownership.js';
import * as ctrl from './survey.controller.js';

const router = Router();

router.use(protect);
router.post('/', ctrl.createSurvey);
router.get('/mine', ctrl.listMySurveys);
router.get('/:id', ctrl.getSurvey);
router.patch('/:id', requireSurveyOwner, ctrl.updateSurvey);
router.delete('/:id', requireSurveyOwner, ctrl.deleteSurvey);

router.post('/:id/questions', requireSurveyOwner, ctrl.addQuestion);
router.patch('/:id/questions/:qid', requireSurveyOwner, ctrl.updateQuestion);
router.delete('/:id/questions/:qid', requireSurveyOwner, ctrl.deleteQuestion);
router.post('/:id/questions/reorder', requireSurveyOwner, ctrl.reorderQuestions);

router.post('/:id/publish', requireSurveyOwner, ctrl.publishSurvey);
router.post('/:id/close', requireSurveyOwner, ctrl.closeSurvey);
router.patch('/:id/deadline', requireSurveyOwner, ctrl.setDeadline);

export default router;

export const publicSurveyRouter = Router();
publicSurveyRouter.get('/surveys/:id/form', optionalAuth, ctrl.getSurveyForm);
