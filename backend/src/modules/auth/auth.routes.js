import { Router } from 'express';
import { registerHandler, loginHandler } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', registerHandler);
authRouter.post('/login', loginHandler);
