// ============================================================================
// voice.socket.js
// ----------------------------------------------------------------------------
// Señalización WebRTC para dos escenarios:
//
// 1. Canales de voz de servidor (modelo mesh): varios participantes, cada
//    cliente abre una RTCPeerConnection con cada uno de los demás. Rooms:
//    `voice-channel:${channelId}`.
//
// 2. Llamadas 1:1 por DM (voz o video): un flujo de "llamando -> contestar
//    o rechazar -> conectado -> colgar", con su propio room
//    `dm-call:${conversationId}`.
//
// En ambos casos este servidor NUNCA toca el audio/video real: solo
// transporta mensajes de señalización (quién está presente, ofertas y
// respuestas SDP, candidatos ICE). Todo el audio/video viaja directamente
// entre los navegadores (P2P) una vez establecida la conexión.
// ============================================================================
import * as dmService from '../dm/dm.service.js';
import * as channelService from '../channels/channel.service.js';
import * as serverService from '../servers/server.service.js';
import { prisma } from '../../config/prisma.js';

const USER_VOICE_SELECT = {
  id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true, customStatus: true, bio: true,
};

const activeCallTimers = new Map();

async function voiceParticipantPayload(userId, socketId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_VOICE_SELECT,
  });
  return {
    userId,
    socketId,
    username: user?.displayName || user?.username || 'Usuario',
    avatarColor: user?.avatarColor,
    avatarUrl: user?.avatarUrl,
    customStatus: user?.customStatus,
    bio: user?.bio,
  };
}

// channelId -> Set de { userId, socketId, username }
const voiceChannelParticipants = new Map();

function voiceChannelRoom(channelId) {
  return `voice-channel:${channelId}`;
}
function dmCallRoom(conversationId) {
  return `dm-call:${conversationId}`;
}

function getParticipants(channelId) {
  return Array.from(voiceChannelParticipants.get(channelId)?.values() || []);
}

export function registerVoiceHandlers(io, socket) {
  const userId = socket.user.id;
  const username = socket.user.username;

  // ── Canales de voz de servidor (mesh, N participantes) ────────────────────

  // Permite al frontend solicitar los participantes actuales de todos los
  // canales de voz de un servidor (útil al cambiar de servidor o reconectar).
  socket.on('voice:request-participants', async ({ serverId }, callback) => {
    try {
      const result = {};
      for (const [channelId, pMap] of voiceChannelParticipants.entries()) {
        if (pMap.size === 0) continue;
        try {
          const channel = await channelService.getChannelById(channelId);
          if (channel?.serverId === serverId) {
            result[channelId] = Array.from(pMap.values());
          }
        } catch (err) {
          console.error(`Error querying channel ${channelId} in request-participants:`, err);
        }
      }
      callback?.({ ok: true, byChannel: result });
    } catch (err) {
      console.error('Error in request-participants handler:', err);
      callback?.({ ok: true, byChannel: {} });
    }
  });

  socket.on('voice:join', async ({ channelId, muted, deafened, isScreenSharing, isCameraOn, cameraStreamId, screenShareStreamId }, callback) => {
    try {
      const channel = await channelService.getChannelById(channelId);
      if (!channel) return callback?.({ ok: false, error: 'Canal no encontrado' });
      const member = await serverService.isMember(userId, channel.serverId);
      if (!member) return callback?.({ ok: false, error: 'No eres miembro de este servidor' });

      socket.join(voiceChannelRoom(channelId));
      socket.data.voiceChannelId = channelId;

      if (!voiceChannelParticipants.has(channelId)) {
        voiceChannelParticipants.set(channelId, new Map());
      }
      const participants = voiceChannelParticipants.get(channelId);
      const existing = getParticipants(channelId);
      const selfPayload = await voiceParticipantPayload(userId, socket.id);
      selfPayload.muted = !!muted;
      selfPayload.deafened = !!deafened;
      selfPayload.isScreenSharing = !!isScreenSharing;
      selfPayload.isCameraOn = !!isCameraOn;
      selfPayload.cameraStreamId = cameraStreamId || null;
      selfPayload.screenShareStreamId = screenShareStreamId || null;
      participants.set(socket.id, selfPayload);

      // Al nuevo participante le mandamos quién ya estaba, para que abra
      // una RTCPeerConnection con cada uno (es quien inicia las ofertas).
      callback?.({ ok: true, participants: existing });

      // Al resto del canal les avisamos de que alguien nuevo se unió.
      socket.to(voiceChannelRoom(channelId)).emit('voice:user-joined', selfPayload);

      // A todos los miembros del servidor les mandamos la lista completa
      // de participantes de este canal, para que puedan ver quién está
      // en la llamada aunque ellos no estén conectados.
      io.to(`server:${channel.serverId}`).emit('voice:channel-participants', {
        channelId,
        participants: getParticipants(channelId),
      });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('voice:leave', ({ channelId }) => {
    leaveVoiceChannel(io, socket, channelId);
  });

  // Detectar cambio de estado de silenciado/ensordecido/compartiendo pantalla
  socket.on('voice:state-update', async ({ channelId, muted, deafened, isScreenSharing, isCameraOn, cameraStreamId, screenShareStreamId }) => {
    try {
      const participants = voiceChannelParticipants.get(channelId);
      if (participants && participants.has(socket.id)) {
        const p = participants.get(socket.id);
        p.muted = !!muted;
        p.deafened = !!deafened;
        p.isScreenSharing = !!isScreenSharing;
        p.isCameraOn = !!isCameraOn;
        p.cameraStreamId = cameraStreamId || null;
        p.screenShareStreamId = screenShareStreamId || null;

        // Al resto del canal les avisamos de la actualización
        socket.to(voiceChannelRoom(channelId)).emit('voice:state-updated', {
          socketId: socket.id,
          userId,
          muted: !!muted,
          deafened: !!deafened,
          isScreenSharing: !!isScreenSharing,
          isCameraOn: !!isCameraOn,
          cameraStreamId: cameraStreamId || null,
          screenShareStreamId: screenShareStreamId || null,
        });

        // A todos los miembros del servidor les mandamos la lista completa
        const channel = await channelService.getChannelById(channelId);
        if (channel) {
          io.to(`server:${channel.serverId}`).emit('voice:channel-participants', {
            channelId,
            participants: getParticipants(channelId),
          });
        }
      }
    } catch (err) {
      console.error('Error handling voice:state-update:', err);
    }
  });

  // Detectar actividad de voz: el cliente emite esto cuando empieza/para de hablar.
  // Lo retransmitimos a los demás participantes del canal para que muestren
  // el borde verde en el avatar del hablante.
  socket.on('voice:speaking', ({ channelId, speaking }) => {
    socket.to(voiceChannelRoom(channelId)).emit('voice:speaking', {
      socketId: socket.id,
      userId,
      speaking,
    });
  });

  // Ofertas/respuestas SDP y candidatos ICE se reenvían 1:1 entre dos
  // sockets concretos dentro del mismo canal de voz, identificados por
  // socketId (no por userId, porque un usuario podría tener varias
  // pestañas, aunque en voz solo tendría sentido una a la vez).
  socket.on('voice:signal', ({ to, signal }) => {
    io.to(to).emit('voice:signal', { from: socket.id, fromUserId: userId, signal });
  });

  // ── Llamadas 1:1 por DM ────────────────────────────────────────────────────

  socket.on('call:invite', async ({ conversationId, type, otherUser }, callback) => {
    try {
      const participant = await dmService.isParticipant(userId, conversationId);
      if (!participant) return callback?.({ ok: false, error: 'No participas en esta conversación' });

      const otherIds = await dmService.getOtherParticipantIds(conversationId, userId);
      socket.join(dmCallRoom(conversationId));
      socket.data.dmCallConversationId = conversationId;

      await prisma.callLog.create({
        data: { conversationId, callerId: userId, type: type === 'video' ? 'video' : 'voice' },
      });

      const callerUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true, avatarColor: true },
      });

      // Cancelar cualquier timer previo para esta conversación
      if (activeCallTimers.has(conversationId)) {
        clearTimeout(activeCallTimers.get(conversationId));
        activeCallTimers.delete(conversationId);
      }

      // Iniciar timer de 30 segundos para timeout de llamada (no contesta)
      const timerId = setTimeout(async () => {
        activeCallTimers.delete(conversationId);

        // Registrar como perdida (missed)
        await logCallResult(io, conversationId, 'missed');

        // Notificar fin de llamada por timeout
        io.to(dmCallRoom(conversationId)).emit('call:ended', { conversationId });
        for (const otherId of otherIds) {
          io.to(`user:${otherId}`).emit('call:ended', { conversationId });
        }
      }, 30000);

      activeCallTimers.set(conversationId, timerId);

      for (const otherId of otherIds) {
        io.to(`user:${otherId}`).emit('call:incoming', {
          conversationId,
          type: type === 'video' ? 'video' : 'voice',
          callerId: userId,
          callerUsername: username,
          callerAvatarUrl: callerUser?.avatarUrl,
          callerAvatarColor: callerUser?.avatarColor,
        });
      }
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('call:accept', async ({ conversationId }, callback) => {
    try {
      const participant = await dmService.isParticipant(userId, conversationId);
      if (!participant) return callback?.({ ok: false, error: 'No participas en esta conversación' });

      // Cancelar el timer de timeout al contestar la llamada
      if (activeCallTimers.has(conversationId)) {
        clearTimeout(activeCallTimers.get(conversationId));
        activeCallTimers.delete(conversationId);
      }

      socket.join(dmCallRoom(conversationId));
      socket.data.dmCallConversationId = conversationId;

      // Marcar la llamada como contestada (cambiar a 'completed' pero sin poner endedAt todavía)
      const lastCall = await prisma.callLog.findFirst({
        where: { conversationId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (lastCall) {
        await prisma.callLog.update({
          where: { id: lastCall.id },
          data: { status: 'completed' },
        });
      }

      io.to(dmCallRoom(conversationId)).emit('call:accepted', { conversationId, userId });
      io.to(`user:${userId}`).emit('call:accepted', { conversationId, userId });
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('call:decline', async ({ conversationId }) => {
    if (activeCallTimers.has(conversationId)) {
      clearTimeout(activeCallTimers.get(conversationId));
      activeCallTimers.delete(conversationId);
    }
    await logCallResult(io, conversationId, 'declined', userId);
    io.to(dmCallRoom(conversationId)).emit('call:declined', { conversationId, userId });
    io.to(`user:${userId}`).emit('call:declined', { conversationId, userId });
  });

  socket.on('call:hangup', async ({ conversationId }) => {
    if (activeCallTimers.has(conversationId)) {
      clearTimeout(activeCallTimers.get(conversationId));
      activeCallTimers.delete(conversationId);
    }
    await logCallResult(io, conversationId);
    io.to(dmCallRoom(conversationId)).emit('call:ended', { conversationId, userId });
    
    // Notificar al canal personal del otro usuario por si aún no había aceptado
    const otherIds = await dmService.getOtherParticipantIds(conversationId, userId).catch(() => []);
    for (const otherId of otherIds) {
      io.to(`user:${otherId}`).emit('call:ended', { conversationId, userId });
    }
    
    socket.leave(dmCallRoom(conversationId));
  });

  // Señalización SDP/ICE de la llamada DM: aquí basta con reenviar a todo
  // el room de la llamada (solo hay 2 participantes, así que no hace
  // falta dirigir por socketId concreto como en los canales de voz).
  socket.on('call:signal', ({ conversationId, signal }) => {
    socket.to(dmCallRoom(conversationId)).emit('call:signal', { from: userId, signal });
  });

  socket.on('disconnect', () => {
    if (socket.data.voiceChannelId) {
      leaveVoiceChannel(io, socket, socket.data.voiceChannelId);
    }
    if (socket.data.dmCallConversationId) {
      const conversationId = socket.data.dmCallConversationId;
      if (activeCallTimers.has(conversationId)) {
        clearTimeout(activeCallTimers.get(conversationId));
        activeCallTimers.delete(conversationId);
      }
      logCallResult(io, conversationId).catch(() => {});
      io.to(dmCallRoom(conversationId)).emit('call:ended', { conversationId, userId });
      
      dmService.getOtherParticipantIds(conversationId, userId).then((otherIds) => {
        for (const otherId of otherIds) {
          io.to(`user:${otherId}`).emit('call:ended', { conversationId, userId });
        }
      }).catch(() => {});
    }
  });
}

async function leaveVoiceChannel(io, socket, channelId) {
  const participants = voiceChannelParticipants.get(channelId);
  console.log('[voice.socket.js] leaveVoiceChannel channelId:', channelId, 'remaining count before delete:', participants?.size);
  if (participants) {
    participants.delete(socket.id);
    if (participants.size === 0) {
      voiceChannelParticipants.delete(channelId);
    }
  }
  io.to(voiceChannelRoom(channelId)).emit('voice:user-left', { socketId: socket.id, userId: socket.user.id });
  socket.leave(voiceChannelRoom(channelId));
  socket.data.voiceChannelId = null;

  // Notificar a todos los miembros del servidor la lista actualizada
  try {
    const channel = await channelService.getChannelById(channelId);
    if (channel) {
      const remaining = getParticipants(channelId);
      console.log('[voice.socket.js] Emitting voice:channel-participants to server room:', channel.serverId, 'remaining participants:', remaining);
      io.to(`server:${channel.serverId}`).emit('voice:channel-participants', {
        channelId,
        participants: remaining,
      });
    } else {
      console.warn('[voice.socket.js] channel not found for ID:', channelId);
    }
  } catch (err) {
    console.error('[voice.socket.js] failed to emit voice:channel-participants:', err);
  }
}

async function logCallResult(io, conversationId, newStatus = null, extraId = null) {
  try {
    const lastCall = await prisma.callLog.findFirst({
      where: { conversationId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (lastCall) {
      const endedAt = new Date();
      const status = newStatus || lastCall.status; // Si no se pasa nuevo estado, mantiene el actual ('completed' o 'missed')
      await prisma.callLog.update({
        where: { id: lastCall.id },
        data: { status, endedAt },
      });

      // Crear mensaje de sistema en el chat del DM
      let content = '';
      if (status === 'completed') {
        const durationSeconds = Math.round((endedAt - lastCall.startedAt) / 1000);
        content = `[call:completed:${durationSeconds}:${lastCall.type}]`;
      } else if (status === 'declined') {
        content = `[call:declined:${lastCall.type}:${extraId || ''}]`;
      } else if (status === 'missed') {
        content = `[call:missed:${lastCall.type}]`;
      }

      if (content) {
        const systemMessage = await dmService.createMessage({
          conversationId,
          authorId: lastCall.callerId,
          content,
        });

        // Obtener los IDs de usuario que están actualmente en la sala de la conversación
        const socketsInRoom = await io.in(`dm:${conversationId}`).fetchSockets();
        const activeUserIds = new Set(socketsInRoom.map((s) => s.user?.id).filter(Boolean));

        // El emisor del log siempre lo lee
        await dmService.markConversationRead({ userId: lastCall.callerId, conversationId });

        // Emitir el mensaje al room del DM
        io.to(`dm:${conversationId}`).emit('dm:new-message', systemMessage);

        // Notificar a los canales personales
        const otherIds = await dmService.getOtherParticipantIds(conversationId, lastCall.callerId).catch(() => []);
        for (const otherId of otherIds) {
          if (activeUserIds.has(otherId)) {
            // El receptor está viendo el chat en este momento, actualizamos su lectura
            await dmService.markConversationRead({ userId: otherId, conversationId });
            io.to(`user:${otherId}`).emit('dm:conversation-updated', { conversationId, message: systemMessage });
            io.to(`user:${otherId}`).emit('dm:read-sync', { conversationId });
          } else {
            // El receptor NO está viendo el chat, enviamos la alerta de no leído
            io.to(`user:${otherId}`).emit('dm:conversation-updated', { conversationId, message: systemMessage });
            io.to(`user:${otherId}`).emit('dm:unread-update', { conversationId });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error logging call result:', err);
  }
}