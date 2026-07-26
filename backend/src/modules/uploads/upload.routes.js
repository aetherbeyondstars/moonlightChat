import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { createUploader } from './upload.config.js';
import {
  uploadAvatarHandler,
  uploadServerIconHandler,
  uploadMessageImageHandler,
  uploadBannerHandler,
} from './upload.controller.js';
 
export const uploadRouter = Router();
 
uploadRouter.use(requireAuth);
 
const avatarUploader = createUploader('avatars');
const serverIconUploader = createUploader('servers');
const messageImageUploader = createUploader('messages');
const bannerUploader = createUploader('banners');
 
uploadRouter.post('/avatar', avatarUploader.single('file'), uploadAvatarHandler);
uploadRouter.post('/server/:serverId/icon', serverIconUploader.single('file'), uploadServerIconHandler);
uploadRouter.post('/message-image', messageImageUploader.single('file'), uploadMessageImageHandler);
uploadRouter.post('/banner', bannerUploader.single('file'), uploadBannerHandler);
