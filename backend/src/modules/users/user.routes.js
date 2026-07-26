import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { getProfileHandler, updateProfileHandler } from './user.controller.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.patch('/me', updateProfileHandler);
userRouter.get('/:userId', getProfileHandler);
