import { Router } from 'express';
import { registerCtrl, loginCtrl, meCtrl } from './auth.controller.js';
import { protect } from '../../common/middlewares/auth.js';

const router = Router();

router.post('/register', registerCtrl);
router.post('/login', loginCtrl);
router.get('/me', protect, meCtrl);

export default router;
