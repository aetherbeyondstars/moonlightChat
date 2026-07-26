import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  sendFriendRequestHandler,
  acceptFriendRequestHandler,
  declineFriendRequestHandler,
  removeFriendHandler,
  listFriendsHandler,
  listRequestsHandler,
} from './friendship.controller.js';

export const friendRouter = Router();

friendRouter.use(requireAuth);

friendRouter.get('/', listFriendsHandler);
friendRouter.get('/requests', listRequestsHandler);
friendRouter.post('/requests', sendFriendRequestHandler);
friendRouter.post('/requests/:requestId/accept', acceptFriendRequestHandler);
friendRouter.post('/requests/:requestId/decline', declineFriendRequestHandler);
friendRouter.delete('/:friendId', removeFriendHandler);
