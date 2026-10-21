import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { config } from '../../config/env.js';
import { unauthorized } from '../errors/index.js';
import { User } from '../../modules/users/user.model.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next(unauthorized('Not authorized, token required'));
  const decoded = jwt.verify(token, config.jwtSecret);
  const user = await User.findById(decoded.id).select('-password');
  if (!user) return next(unauthorized('User no longer exists'));
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select('-password');
      if (user) req.user = user;
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  next();
});
