import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  listConversationsHandler,
  openConversationHandler,
  listMessagesHandler,
  toggleReactionHandler,
  closeConversationHandler,
} from './dm.controller.js';

export const dmRouter = Router();

dmRouter.use(requireAuth);

dmRouter.get('/conversations', listConversationsHandler);
dmRouter.post('/conversations', openConversationHandler);
dmRouter.delete('/conversations/:conversationId', closeConversationHandler);
dmRouter.get('/conversations/:conversationId/messages', listMessagesHandler);
dmRouter.post('/messages/:messageId/reactions', toggleReactionHandler);
