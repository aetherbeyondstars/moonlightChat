import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  listMessagesHandler,
  editMessageHandler,
  deleteMessageHandler,
  toggleReactionHandler,
} from './message.controller.js';

export const messageRouter = Router();
messageRouter.use(requireAuth);

messageRouter.get('/channel/:channelId', listMessagesHandler);
messageRouter.patch('/:messageId', editMessageHandler);
messageRouter.delete('/:messageId', deleteMessageHandler);
messageRouter.post('/:messageId/reactions', toggleReactionHandler);
