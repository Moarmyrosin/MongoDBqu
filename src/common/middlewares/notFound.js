import { notFound } from '../errors/index.js';

export const notFoundHandler = (req, res, next) => {
  next(notFound(`Cannot find ${req.originalUrl}`));
};
