import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  createServerHandler,
  listServersHandler,
  joinServerHandler,
  listMembersHandler,
  getServerHandler,
  leaveServerHandler,
  deleteServerHandler,
  reorderServersHandler,
  inviteFriendHandler,
  updateServerHandler,
} from './server.controller.js';
 
export const serverRouter = Router();
 
serverRouter.use(requireAuth); // todas las rutas de servers requieren login
 
serverRouter.get('/', listServersHandler);
serverRouter.post('/', createServerHandler);
serverRouter.post('/join', joinServerHandler);
serverRouter.post('/reorder', reorderServersHandler);
serverRouter.get('/:serverId', getServerHandler);
serverRouter.patch('/:serverId', updateServerHandler);
serverRouter.delete('/:serverId', deleteServerHandler);
serverRouter.post('/:serverId/leave', leaveServerHandler);
serverRouter.get('/:serverId/members', listMembersHandler);
serverRouter.post('/:serverId/invite-friend', inviteFriendHandler);
