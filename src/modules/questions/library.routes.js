import { Router } from 'express';
import { protect } from '../../common/middlewares/auth.js';
import * as ctrl from './library.controller.js';

const questionRouter = Router();
const bankRouter = Router();

questionRouter.use(protect);

questionRouter.post('/', ctrl.createQuestion);
questionRouter.get('/mine', ctrl.listMyQuestions);
questionRouter.get('/shared', ctrl.listSharedQuestions);
questionRouter.get('/:id/versions', ctrl.getVersionHistory);
questionRouter.get('/:id/usage', ctrl.getUsage);
questionRouter.get('/:id/analytics', ctrl.getQuestionAnalytics);
questionRouter.get('/:id/shared-users', ctrl.listSharedUsers);
questionRouter.get('/:id', ctrl.getQuestion);
questionRouter.patch('/:id/share', ctrl.updateShare);
questionRouter.post('/:id/restore', ctrl.restoreVersion);
questionRouter.patch('/:id', ctrl.updateQuestion);
questionRouter.delete('/:id', ctrl.deleteQuestion);

bankRouter.use(protect);

bankRouter.post('/', ctrl.createBank);
bankRouter.get('/mine', ctrl.listBanks);
bankRouter.get('/:id/questions', ctrl.listBankQuestions);
bankRouter.patch('/:id', ctrl.updateBank);
bankRouter.delete('/:id', ctrl.deleteBank);
bankRouter.post('/:id/questions', ctrl.addQuestionToBank);
bankRouter.delete('/:id/questions/:qid', ctrl.removeQuestionFromBank);

export { questionRouter, bankRouter };
