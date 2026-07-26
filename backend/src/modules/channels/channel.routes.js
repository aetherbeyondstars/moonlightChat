import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  createChannelHandler,
  listChannelsHandler,
  renameChannelHandler,
  deleteChannelHandler,
} from './channel.controller.js';

export const channelRouter = Router();

channelRouter.use(requireAuth);

channelRouter.post('/', createChannelHandler);
channelRouter.get('/server/:serverId', listChannelsHandler);
channelRouter.patch('/:channelId', renameChannelHandler);
channelRouter.delete('/:channelId', deleteChannelHandler);
