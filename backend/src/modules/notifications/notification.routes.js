import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  listUnreadHandler,
  markServerReadHandler,
  markConversationReadHandler,
  markChannelReadHandler,
} from './notification.controller.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/unread', listUnreadHandler);
notificationRouter.post('/server/:serverId/read', markServerReadHandler);
notificationRouter.post('/conversation/:conversationId/read', markConversationReadHandler);
notificationRouter.post('/channel/:channelId/read', markChannelReadHandler);
