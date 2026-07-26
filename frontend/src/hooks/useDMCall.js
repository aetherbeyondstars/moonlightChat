// ============================================================================
// useDMCall.js — llamadas DM con soporte de cámara + pantalla simultáneos
// Arquitectura: dos senders de vídeo separados (cámara + pantalla),
// igual que useVoiceChannel. Nunca se hace replaceTrack para pantalla.
// ============================================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket, onSocketChange } from '@/lib/socket';
import { api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export function useDMCall({ onBeforeCall } = {}) {
  const { session } = useAuth();
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('voice');
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  // Stream de audio+cámara (el stream base de la llamada)
  const [localStream, setLocalStream] = useState(null);
  // Stream separado solo con la pista de cámara (para el tile local cuando hay screen share)
  const [localCameraStream, setLocalCameraStream] = useState(null);
  // Stream de pantalla compartida (solo cuando se comparte)
  const [localScreenShareStream, setLocalScreenShareStream] = useState(null);

  // Streams remotos separados — cámara y pantalla independientes
  const [remoteStream, setRemoteStream] = useState(null);         // audio (para RemoteAudio)
  const [remoteVideoStream, setRemoteVideoStream] = useState(null); // cámara remota
  const [remoteScreenStream, setRemoteScreenStream] = useState(null); // pantalla remota

  const [remoteCameraOn, setRemoteCameraOn] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [remoteDeafened, setRemoteDeafened] = useState(false);
  const [callUser, setCallUser] = useState(null);
  const [muted, setMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);

  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isCallerRef = useRef(false);
  const activeConversationIdRef = useRef(null);
  const callStateRef = useRef('idle');

  // Sender refs para controlar los senders de vídeo WebRTC independientemente
  const cameraSenderRef = useRef(null);       // sender del track de cámara
  const screenSenderRef = useRef(null);       // sender del track de pantalla

  // Ref para guardar el stream ID del stream principal (de audio/cámara) para identificarlo
  const remoteMainStreamIdRef = useRef(null);

  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const cleanup = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingCandidatesRef.current = [];
    cameraSenderRef.current = null;
    screenSenderRef.current = null;
    remoteMainStreamIdRef.current = null;

    localStream?.getTracks().forEach((t) => t.stop());
    localCameraStream?.getTracks().forEach((t) => t.stop());
    localScreenShareStream?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setLocalCameraStream(null);
    setLocalScreenShareStream(null);
    setRemoteStream(null);
    setRemoteVideoStream(null);
    setRemoteScreenStream(null);
    setRemoteCameraOn(true);
    setRemoteMuted(false);
    setDeafened(false);
    setRemoteDeafened(false);
    setCallUser(null);
    setMuted(false);
    setIsCameraOn(false);
    setCallState('idle');
    setActiveConversationId(null);
    setIncomingCall(null);
    isCallerRef.current = false;
    setIsScreenSharing(false);
    setRemoteScreenSharing(false);
  }, [localStream, localCameraStream, localScreenShareStream]);

  const createPeerConnection = useCallback(async (conversationId) => {
    const { iceServers } = await api.getIceServers(session.token);
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('call:signal', {
          conversationId,
          signal: { type: 'ice-candidate', candidate: event.candidate },
        });
      }
    };

    // Gestionar tracks remotos: separar audio, cámara y pantalla
    pc.ontrack = (event) => {
      const { track, streams } = event;
      const stream = streams[0];
      if (!stream) return;

      if (track.kind === 'audio') {
        // Audio — usado por RemoteAudio para reproducción
        setRemoteStream(stream);
        remoteMainStreamIdRef.current = stream.id;
        return;
      }

      if (track.kind === 'video') {
        // Si el stream ID coincide con el stream de audio principal, es la cámara
        const isMainStream = remoteMainStreamIdRef.current 
          ? (stream.id === remoteMainStreamIdRef.current)
          : true; // fallback

        if (isMainStream) {
          if (!remoteMainStreamIdRef.current) {
            remoteMainStreamIdRef.current = stream.id;
          }
          setRemoteVideoStream(stream);
          track.onended = () => setRemoteVideoStream(null);
        } else {
          // Segundo stream = pantalla compartida
          setRemoteScreenStream(stream);
          track.onended = () => setRemoteScreenStream(null);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallState('connected');
      if (['failed', 'closed'].includes(pc.connectionState)) cleanup();
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [session, cleanup]);

  const getLocalMedia = useCallback(async () => {
    const savedAudioId = localStorage.getItem('moonlight:audioInputId');
    const savedVideoId = localStorage.getItem('moonlight:videoInputId');
    const audioConstraints = savedAudioId && savedAudioId !== 'default' ? { deviceId: { exact: savedAudioId } } : true;
    const videoConstraints = savedVideoId && savedVideoId !== 'default' ? { deviceId: { exact: savedVideoId } } : true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: videoConstraints });
      setLocalStream(stream);
      const camStream = new MediaStream(stream.getVideoTracks());
      setLocalCameraStream(camStream);
      return stream;
    } catch (err) {
      console.warn('Failed to get media with exact constraints, trying fallback:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        const camStream = new MediaStream(stream.getVideoTracks());
        setLocalCameraStream(camStream);
        return stream;
      } catch {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        setLocalCameraStream(null);
        return stream;
      }
    }
  }, []);

  const startCall = useCallback(async (conversationId, type = 'voice', otherUser = null) => {
    onBeforeCall?.();
    setCallType(type);
    setActiveConversationId(conversationId);
    setCallState('calling');
    isCallerRef.current = true;
    setRemoteCameraOn(type === 'video');
    setIsCameraOn(type === 'video');
    setCallUser(otherUser);

    try {
      const stream = await getLocalMedia();
      if (type === 'voice') {
        stream.getVideoTracks().forEach((t) => { t.enabled = false; });
      } else {
        stream.getVideoTracks().forEach((t) => { t.enabled = true; });
      }
      const pc = await createPeerConnection(conversationId);

      // Añadir audio y vídeo como tracks SEPARADOS al peer connection
      // Audio: en el stream completo
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      // Vídeo (cámara): guardamos el sender para poder controlarlo después
      stream.getVideoTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        cameraSenderRef.current = sender;
      });

      getSocket().emit('call:invite', { conversationId, type }, (response) => {
        if (!response?.ok) cleanup();
      });
    } catch {
      cleanup();
    }
  }, [getLocalMedia, createPeerConnection, cleanup, onBeforeCall]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    onBeforeCall?.();
    const { conversationId, type } = incomingCall;
    setCallType(type);
    setActiveConversationId(conversationId);
    setCallState('calling');
    isCallerRef.current = false;
    setIncomingCall(null);
    setRemoteCameraOn(type === 'video');
    setIsCameraOn(type === 'video');

    try {
      const stream = await getLocalMedia();
      if (type === 'voice') {
        stream.getVideoTracks().forEach((t) => { t.enabled = false; });
      } else {
        stream.getVideoTracks().forEach((t) => { t.enabled = true; });
      }
      const pc = await createPeerConnection(conversationId);

      // Añadir audio y vídeo como tracks SEPARADOS al peer connection
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      stream.getVideoTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        cameraSenderRef.current = sender;
      });

      setCallUser({
        id: incomingCall.callerId,
        username: incomingCall.callerUsername,
        avatarUrl: incomingCall.callerAvatarUrl,
        avatarColor: incomingCall.callerAvatarColor
      });

      getSocket().emit('call:accept', { conversationId }, (response) => {
        if (!response?.ok) cleanup();
      });
    } catch {
      cleanup();
    }
  }, [incomingCall, getLocalMedia, createPeerConnection, cleanup, onBeforeCall]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;
    getSocket().emit('call:decline', { conversationId: incomingCall.conversationId });
    setIncomingCall(null);
  }, [incomingCall]);

  const hangUp = useCallback(() => {
    if (activeConversationIdRef.current) {
      getSocket().emit('call:hangup', { conversationId: activeConversationIdRef.current });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (deafened) return;
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStream?.getAudioTracks().forEach((t) => { t.enabled = !nextMuted; });
    if (activeConversationIdRef.current) {
      getSocket().emit('call:signal', {
        conversationId: activeConversationIdRef.current,
        signal: { type: 'mute-state', muted: nextMuted }
      });
    }
  }, [localStream, deafened, muted]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !deafened;
    setDeafened(nextDeafened);
    let nextMuted = muted;
    if (nextDeafened) { nextMuted = true; setMuted(true); }
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !nextDeafened && !nextMuted;
    });
    if (activeConversationIdRef.current) {
      getSocket().emit('call:signal', {
        conversationId: activeConversationIdRef.current,
        signal: { type: 'deafen-state', deafened: nextDeafened, muted: nextDeafened || nextMuted }
      });
    }
  }, [deafened, muted, localStream]);

  const toggleCamera = useCallback(async () => {
    let videoTracks = localStream?.getVideoTracks() || [];
    const hasActiveTrack = videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live');

    if (hasActiveTrack) {
      let enabled = false;
      videoTracks.forEach((t) => {
        t.enabled = !t.enabled;
        enabled = t.enabled;
      });

      const liveTrack = videoTracks.find(t => t.readyState === 'live');
      if (liveTrack) {
        setLocalCameraStream(new MediaStream([liveTrack]));
      }

      setIsCameraOn(enabled);

      if (peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          if (activeConversationIdRef.current) {
            getSocket().emit('call:signal', {
              conversationId: activeConversationIdRef.current,
              signal: { type: 'offer', sdp: offer }
            });
          }
        } catch (e) {
          console.warn('Error renegotiating offer on camera toggle:', e);
        }
      }

      if (activeConversationIdRef.current) {
        getSocket().emit('call:signal', {
          conversationId: activeConversationIdRef.current,
          signal: { type: 'camera-state', cameraOn: enabled }
        });
      }
    } else {
      // Si no hay pista de vídeo activa (p. ej. llamada de voz en .exe o fallback inicial sin cámara)
      // Solicitamos acceso a la cámara dinámicamente ahora que el usuario quiere encenderla
      try {
        const savedVideoId = localStorage.getItem('moonlight:videoInputId');
        const videoConstraints = savedVideoId && savedVideoId !== 'default' ? { deviceId: { exact: savedVideoId } } : true;
        let camMedia;
        try {
          camMedia = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        } catch {
          camMedia = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        const newTrack = camMedia.getVideoTracks()[0];
        if (!newTrack) return;

        newTrack.enabled = true;
        
        // Actualizar localCameraStream
        const newCamStream = new MediaStream([newTrack]);
        setLocalCameraStream(newCamStream);

        // Actualizar localStream adjuntando la pista de vídeo
        if (localStream) {
          localStream.getVideoTracks().forEach(t => localStream.removeTrack(t));
          localStream.addTrack(newTrack);
        } else {
          setLocalStream(newCamStream);
        }

        // Añadir o reemplazar la pista en la conexión WebRTC
        if (peerConnectionRef.current) {
          if (cameraSenderRef.current) {
            await cameraSenderRef.current.replaceTrack(newTrack);
          } else {
            const sender = peerConnectionRef.current.addTrack(newTrack, localStream || newCamStream);
            cameraSenderRef.current = sender;
            try {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              getSocket().emit('call:signal', {
                conversationId: activeConversationIdRef.current,
                signal: { type: 'offer', sdp: offer }
              });
            } catch (e) {
              console.warn('Error renegotiating offer after adding camera dynamically:', e);
            }
          }
        }

        setIsCameraOn(true);
        if (activeConversationIdRef.current) {
          getSocket().emit('call:signal', {
            conversationId: activeConversationIdRef.current,
            signal: { type: 'camera-state', cameraOn: true }
          });
        }
      } catch (err) {
        console.error('Error al solicitar cámara dinámicamente en llamada DM:', err);
        setIsCameraOn(false);
      }
    }
  }, [localStream]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // ── Detener screen share ──────────────────────────────────────────────
      // Parar todos los tracks de la pantalla
      localScreenShareStream?.getTracks().forEach((t) => t.stop());

      // Quitar el sender de pantalla del peer connection
      if (screenSenderRef.current && peerConnectionRef.current) {
        try {
          peerConnectionRef.current.removeTrack(screenSenderRef.current);
        } catch (e) {
          console.warn('Error removing screen sender:', e);
        }
        screenSenderRef.current = null;
      }

      setLocalScreenShareStream(null);
      setIsScreenSharing(false);

      if (activeConversationIdRef.current) {
        getSocket().emit('call:signal', {
          conversationId: activeConversationIdRef.current,
          signal: { type: 'screen-share-state', sharing: false }
        });
      }
    } else {
      // ── Iniciar screen share ──────────────────────────────────────────────
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = displayStream.getVideoTracks()[0];

        setLocalScreenShareStream(displayStream);

        // Añadir el track de pantalla como un SEGUNDO sender de vídeo
        // (sin tocar el sender de cámara — ambos coexisten en la misma PC)
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.addTrack(screenTrack, displayStream);
          screenSenderRef.current = sender;

          // Necesitamos renegociar porque añadimos un nuevo track
          try {
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            getSocket().emit('call:signal', {
              conversationId: activeConversationIdRef.current,
              signal: { type: 'offer', sdp: offer }
            });
          } catch (e) {
            console.warn('Error renegotiating after screen share start:', e);
          }
        }

        setIsScreenSharing(true);

        if (activeConversationIdRef.current) {
          getSocket().emit('call:signal', {
            conversationId: activeConversationIdRef.current,
            signal: { type: 'screen-share-state', sharing: true }
          });
        }

        // Si el usuario cierra la pantalla desde el navegador
        screenTrack.onended = () => { toggleScreenShare(); };
      } catch (err) {
        console.error('Error starting screen share in DM:', err);
      }
    }
  }, [isScreenSharing, localScreenShareStream]);

  useEffect(() => {
    let activeSocket = null;

    function onIncomingCall(payload) {
      if (callStateRef.current !== 'idle') {
        getSocket().emit('call:decline', { conversationId: payload.conversationId });
        return;
      }
      setIncomingCall(payload);
    }

    async function onCallAccepted({ conversationId }) {
      if (conversationId === activeConversationIdRef.current && isCallerRef.current) {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket().emit('call:signal', { conversationId, signal: { type: 'offer', sdp: offer } });
      } else {
        setIncomingCall((prev) => (prev?.conversationId === conversationId ? null : prev));
      }
    }

    function onCallDeclined({ conversationId }) {
      if (conversationId === activeConversationIdRef.current) cleanup();
      setIncomingCall((prev) => (prev?.conversationId === conversationId ? null : prev));
    }

    function onCallEnded({ conversationId }) {
      if (conversationId === activeConversationIdRef.current) cleanup();
      setIncomingCall((prev) => (prev?.conversationId === conversationId ? null : prev));
    }

    async function onSignal({ signal }) {
      if (signal.type === 'screen-share-state') {
        setRemoteScreenSharing(signal.sharing);
        return;
      }
      if (signal.type === 'camera-state') {
        setRemoteCameraOn(signal.cameraOn);
        return;
      }
      if (signal.type === 'mute-state') {
        setRemoteMuted(signal.muted);
        return;
      }
      if (signal.type === 'deafen-state') {
        setRemoteDeafened(signal.deafened);
        setRemoteMuted(signal.muted);
        return;
      }

      const pc = peerConnectionRef.current;
      if (!pc) return;

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit('call:signal', {
          conversationId: activeConversationIdRef.current,
          signal: { type: 'answer', sdp: answer },
        });
        setCallState('connected');
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
        pendingCandidatesRef.current = [];
        setCallState('connected');
      } else if (signal.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(signal.candidate);
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else pendingCandidatesRef.current.push(candidate);
      }
    }

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('call:incoming', onIncomingCall);
        activeSocket.off('call:accepted', onCallAccepted);
        activeSocket.off('call:declined', onCallDeclined);
        activeSocket.off('call:ended', onCallEnded);
        activeSocket.off('call:signal', onSignal);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('call:incoming', onIncomingCall);
      socket.on('call:accepted', onCallAccepted);
      socket.on('call:declined', onCallDeclined);
      socket.on('call:ended', onCallEnded);
      socket.on('call:signal', onSignal);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('call:incoming', onIncomingCall);
        activeSocket.off('call:accepted', onCallAccepted);
        activeSocket.off('call:declined', onCallDeclined);
        activeSocket.off('call:ended', onCallEnded);
        activeSocket.off('call:signal', onSignal);
      }
    };
  }, [cleanup, onBeforeCall]);

  // Cambio de dispositivo de audio en caliente
  useEffect(() => {
    async function handleAudioChange() {
      if (!localStream || !peerConnectionRef.current) return;
      const savedAudioId = localStorage.getItem('moonlight:audioInputId');
      const audioConstraints = savedAudioId && savedAudioId !== 'default' ? { deviceId: { exact: savedAudioId } } : true;
      const oldTrack = localStream.getAudioTracks()[0];
      if (oldTrack) oldTrack.stop();
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        const newTrack = newStream.getAudioTracks()[0];
        const newLocalStream = new MediaStream([newTrack, ...localStream.getVideoTracks()]);
        setLocalStream(newLocalStream);
        const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) await sender.replaceTrack(newTrack);
      } catch (err) {
        console.error('Error al cambiar micro en caliente (DM):', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const fallbackTrack = fallbackStream.getAudioTracks()[0];
          const newLocalStream = new MediaStream([fallbackTrack, ...localStream.getVideoTracks()]);
          setLocalStream(newLocalStream);
          const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) await sender.replaceTrack(fallbackTrack);
        } catch {}
      }
    }

    // Cambio de dispositivo de vídeo (cámara) en caliente
    async function handleVideoChange() {
      if (!localStream || !peerConnectionRef.current) return;
      const savedVideoId = localStorage.getItem('moonlight:videoInputId');
      const videoConstraints = savedVideoId && savedVideoId !== 'default' ? { deviceId: { exact: savedVideoId } } : true;
      const oldTrack = localStream.getVideoTracks()[0];
      if (oldTrack) oldTrack.stop();
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        const newTrack = newStream.getVideoTracks()[0];
        const newLocalStream = new MediaStream([...localStream.getAudioTracks(), newTrack]);
        setLocalStream(newLocalStream);
        const newCamStream = new MediaStream([newTrack]);
        setLocalCameraStream(newCamStream);
        // Reemplazar en el sender de cámara (el camera sender sigue siendo el mismo)
        if (cameraSenderRef.current) {
          await cameraSenderRef.current.replaceTrack(newTrack);
        }
      } catch (err) {
        console.error('Error al cambiar camara en caliente (DM):', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const fallbackTrack = fallbackStream.getVideoTracks()[0];
          const newLocalStream = new MediaStream([...localStream.getAudioTracks(), fallbackTrack]);
          setLocalStream(newLocalStream);
          const newCamStream = new MediaStream([fallbackTrack]);
          setLocalCameraStream(newCamStream);
          if (cameraSenderRef.current) await cameraSenderRef.current.replaceTrack(fallbackTrack);
        } catch {}
      }
    }

    window.addEventListener('moonlight:audiochange', handleAudioChange);
    window.addEventListener('moonlight:videochange', handleVideoChange);
    return () => {
      window.removeEventListener('moonlight:audiochange', handleAudioChange);
      window.removeEventListener('moonlight:videochange', handleVideoChange);
    };
  }, [localStream]);

  const isInCall = ['calling', 'connected'].includes(callState);

  return {
    callState, callType, activeConversationId, incomingCall,
    localStream, localCameraStream, localScreenShareStream,
    remoteStream, remoteVideoStream, remoteScreenStream,
    isInCall, startCall, acceptCall, declineCall, hangUp,
    toggleMute, toggleDeafen, toggleCamera,
    remoteCameraOn, remoteMuted, deafened, remoteDeafened, callUser, muted,
    isCameraOn, isScreenSharing, remoteScreenSharing, toggleScreenShare,
  };
}
