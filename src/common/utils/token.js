import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};
