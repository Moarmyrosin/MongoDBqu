import asyncHandler from 'express-async-handler';
import { register, login, getMe } from './auth.service.js';
import { success, created } from '../../common/response/index.js';

export const registerCtrl = asyncHandler(async (req, res) => {
  const { username, password, email } = req.body;
  const result = await register({ username, password, email });
  return created(res, result, 'Registered successfully');
});

export const loginCtrl = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await login({ username, password });
  return success(res, result, 'Login successful');
});

export const meCtrl = asyncHandler(async (req, res) => {
  const user = await getMe(req.user._id);
  return success(res, user);
});
