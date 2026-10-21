import app from './app.js';
import { connectDB } from './config/db.js';
import { config } from './config/env.js';

const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

start();
