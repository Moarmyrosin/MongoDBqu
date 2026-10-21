import { User } from '../users/user.model.js';
import { generateToken } from '../../common/utils/token.js';
import { badRequest, unauthorized, conflict } from '../../common/errors/index.js';

export const register = async ({ username, password, email }) => {
  if (!username || !password) throw badRequest('Username and password are required');
  const exists = await User.findOne({ username });
  if (exists) throw conflict('Username already exists');
  const user = await User.create({ username, password, email: email || undefined });
  const token = generateToken(user._id);
  const safe = user.toObject();
  delete safe.password;
  return { user: safe, token };
};

export const login = async ({ username, password }) => {
  if (!username || !password) throw badRequest('Username and password are required');
  const user = await User.findOne({ username }).select('+password');
  if (!user) throw unauthorized('Invalid credentials');
  const match = await user.matchPassword(password);
  if (!match) throw unauthorized('Invalid credentials');
  const token = generateToken(user._id);
  const safe = user.toObject();
  delete safe.password;
  return { user: safe, token };
};

export const getMe = async (userId) => {
  return await User.findById(userId).select('-password');
};
