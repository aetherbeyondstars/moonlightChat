import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  createCategoryHandler,
  listCategoriesHandler,
  renameCategoryHandler,
  deleteCategoryHandler,
  reorderCategoriesHandler,
  moveChannelHandler,
} from './category.controller.js';

export const categoryRouter = Router();

categoryRouter.use(requireAuth);

categoryRouter.post('/', createCategoryHandler);
categoryRouter.post('/reorder', reorderCategoriesHandler);
categoryRouter.get('/server/:serverId', listCategoriesHandler);
categoryRouter.patch('/:categoryId', renameCategoryHandler);
categoryRouter.delete('/:categoryId', deleteCategoryHandler);
categoryRouter.patch('/channel/:channelId/move', moveChannelHandler);
