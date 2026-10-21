export const success = (res, data, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const created = (res, data, message = 'Created') => success(res, data, message, 201);
export const noContent = (res) => res.status(204).send();
