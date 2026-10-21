import mongoose from 'mongoose';

export const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);
