// ============================================================================
// useVoiceChannel.js
// ----------------------------------------------------------------------------
// Gestiona la conexión a un canal de voz de servidor usando un modelo mesh:
// se abre una RTCPeerConnection independiente con cada participante ya
// presente (nosotros somos quien ofrece) y con cada nuevo participante que
// se une después (ellos ofrecen, nosotros respondemos). Válido para grupos
// pequeños como los de un "mini-discord"; si el canal crece mucho, este
// hook es el punto a sustituir por un SFU.
// ============================================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket, onSocketChange } from '@/lib/socket';
import { api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export function useVoiceChannel() {
  const { session } = useAuth();
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [participants, setParticipants] = useState([]); // [{ userId, socketId, username }]
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState('');
  const [pingMs, setPingMs] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [joiningChannelId, setJoiningChannelId] = useState(null);

  const localStreamRef = useRef(null);
  const speakingDetectorRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // socketId -> MediaStream
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [localScreenShareStream, setLocalScreenShareStream] = useState(null);

  const iceServersRef = useRef(null);

  const getIceServers = useCallback(async () => {
    if (!iceServersRef.current) {
      const { iceServers } = await api.getIceServers(session.token);
      iceServersRef.current = iceServers;
    }
    return iceServersRef.current;
  }, [session]);

  const closePeer = useCallback((socketId) => {
    peersRef.current.get(socketId)?.close();
    peersRef.current.delete(socketId);
    remoteStreamsRef.current.delete(socketId);
    remoteStreamsRef.current.delete(`${socketId}-screen`);
    setRemoteStreamVersion((v) => v + 1);
  }, []);

  const createPeerFor = useCallback(async ({ socketId, channelId, isOfferer }) => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });
    if (localVideoStream) {
      localVideoStream.getVideoTracks().forEach((track) => {
        pc.addTrack(track, localVideoStream);
      });
    }
    if (localScreenShareStream) {
      localScreenShareStream.getVideoTracks().forEach((track) => {
        pc.addTrack(track, localScreenShareStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('voice:signal', {
          to: socketId,
          signal: { type: 'ice-candidate', candidate: event.candidate, channelId },
        });
      }
    };

    pc.ontrack = (event) => {
      const p = participantsRef.current.find(x => x.socketId === socketId);
      let isScreenShare = false;

      if (event.track.kind === 'video' && p) {
        const streamId = event.streams[0]?.id;
        if (p.isScreenSharing) {
          if (!p.isCameraOn) {
            isScreenShare = true;
          } else if (streamId) {
            isScreenShare = streamId === p.screenShareStreamId;
          } else {
            const mainStream = remoteStreamsRef.current.get(socketId);
            const hasMainVideo = mainStream && mainStream.getVideoTracks().length > 0;
            if (hasMainVideo) {
              isScreenShare = true;
            }
          }
        }
      }

      const key = isScreenShare ? `${socketId}-screen` : socketId;

      let existing = remoteStreamsRef.current.get(key);
      if (!existing) {
        existing = new MediaStream();
        remoteStreamsRef.current.set(key, existing);
      }
      
      if (event.track.kind === 'video') {
        existing.getVideoTracks().forEach(t => existing.removeTrack(t));
      } else if (event.track.kind === 'audio') {
        existing.getAudioTracks().forEach(t => existing.removeTrack(t));
      }
      
      existing.addTrack(event.track);
      setRemoteStreamVersion((v) => v + 1);
    };

    peersRef.current.set(socketId, pc);

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket().emit('voice:signal', {
        to: socketId,
        signal: { type: 'offer', sdp: offer, channelId },
      });
    }

    return pc;
  }, [getIceServers, localVideoStream, localScreenShareStream]);

  const joinChannel = useCallback(async (channelId) => {
    if (channelId === activeChannelId) return;
    setError('');
    setJoiningChannelId(channelId);

    // Si ya estábamos en un canal de voz, lo abandonamos limpiando sus recursos
    if (activeChannelId) {
      const socket = getSocket();
      socket.emit('voice:leave', { channelId: activeChannelId });
      for (const socketId of peersRef.current.keys()) {
        peersRef.current.get(socketId)?.close();
      }
      peersRef.current.clear();
      remoteStreamsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (speakingDetectorRef.current) {
        clearInterval(speakingDetectorRef.current.interval);
        speakingDetectorRef.current.audioCtx.close().catch(() => {});
        speakingDetectorRef.current = null;
      }
      setRemoteStreamVersion((v) => v + 1);
    }

    try {
      const savedAudioId = localStorage.getItem('moonlight:audioInputId');
      const audioConstraints = savedAudioId && savedAudioId !== 'default'
        ? { deviceId: { exact: savedAudioId } }
        : true;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (err) {
        console.warn('Failed to join voice channel with exact constraints, trying fallback:', err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      localStreamRef.current = stream;

      const socket = getSocket();
      socket.emit('voice:join', {
        channelId,
        muted,
        deafened,
        isScreenSharing,
        isCameraOn,
        cameraStreamId: localVideoStream?.id || null,
        screenShareStreamId: localScreenShareStream?.id || null
      }, async (response) => {
        setJoiningChannelId(null);
        if (!response?.ok) {
          setError(response?.error || 'No se pudo unir al canal de voz');
          return;
        }
        setActiveChannelId(channelId);
        const list = response.participants || [];
        participantsRef.current = list;
        setParticipants(list);
        for (const p of list) {
          await createPeerFor({ socketId: p.socketId, channelId, isOfferer: true });
        }

        // Detección de actividad de voz local con AnalyserNode
        try {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          let isSpeaking = false;

          const interval = setInterval(() => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            const nowSpeaking = avg > 8;
            if (nowSpeaking !== isSpeaking) {
              isSpeaking = nowSpeaking;
              getSocket().emit('voice:speaking', { channelId, speaking: isSpeaking });
              setSpeakingUsers((prev) => {
                const next = new Set(prev);
                const selfSocketId = getSocket().id;
                const selfUserId = session?.user?.id;
                if (isSpeaking) {
                  if (selfSocketId) next.add(selfSocketId);
                  if (selfUserId) next.add(selfUserId);
                } else {
                  if (selfSocketId) next.delete(selfSocketId);
                  if (selfUserId) next.delete(selfUserId);
                }
                return next;
              });
            }
          }, 100);

          speakingDetectorRef.current = { audioCtx, interval };
        } catch { /* AudioContext no disponible; seguimos sin el indicador */ }
      });
    } catch (err) {
      setJoiningChannelId(null);
      setError(err.message || 'No se pudo acceder al micrófono');
    }
  }, [createPeerFor, activeChannelId]);

  const leaveChannel = useCallback(() => {
    if (!activeChannelId) return;
    getSocket().emit('voice:leave', { channelId: activeChannelId });
    for (const socketId of peersRef.current.keys()) closePeer(socketId);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    if (localVideoStream) {
      localVideoStream.getTracks().forEach((t) => t.stop());
    }
    if (localScreenShareStream) {
      localScreenShareStream.getTracks().forEach((t) => t.stop());
    }
    setLocalVideoStream(null);
    setLocalScreenShareStream(null);
    setIsCameraOn(false);
    setIsScreenSharing(false);

    if (speakingDetectorRef.current) {
      clearInterval(speakingDetectorRef.current.interval);
      speakingDetectorRef.current.audioCtx.close().catch(() => {});
      speakingDetectorRef.current = null;
    }
    setActiveChannelId(null);
    setParticipants([]);
    setMuted(false);
    setDeafened(false);
    setPingMs(null);
    setSpeakingUsers(new Set());
  }, [activeChannelId, closePeer, localVideoStream, localScreenShareStream]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !nextMuted; });
    setMuted(nextMuted);
    if (!nextMuted && deafened) setDeafened(false);
  }, [muted, deafened]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !deafened;
    setDeafened(nextDeafened);
    if (nextDeafened) {
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      setMuted(true);
    }
  }, [deafened]);

  const addVideoTrackToPeers = useCallback(async (videoTrack, stream) => {
    for (const [socketId, pc] of peersRef.current.entries()) {
      try {
        pc.addTrack(videoTrack, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket().emit('voice:signal', {
          to: socketId,
          signal: { type: 'offer', sdp: offer, channelId: activeChannelId },
        });
      } catch (err) {
        console.error('Error renegotiating track for peer:', socketId, err);
      }
    }
  }, [activeChannelId]);

  const removeVideoTrackFromPeers = useCallback(async (videoTrack) => {
    for (const [socketId, pc] of peersRef.current.entries()) {
      try {
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track === videoTrack);
        if (sender) {
          pc.removeTrack(sender);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          getSocket().emit('voice:signal', {
            to: socketId,
            signal: { type: 'offer', sdp: offer, channelId: activeChannelId },
          });
        }
      } catch (err) {
        console.error('Error renegotiating track removal for peer:', socketId, err);
      }
    }
  }, [activeChannelId]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      if (localVideoStream) {
        localVideoStream.getVideoTracks().forEach((track) => {
          removeVideoTrackFromPeers(track);
          track.stop();
        });
      }
      setLocalVideoStream(null);
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setLocalVideoStream(stream);
        setIsCameraOn(true);
        const track = stream.getVideoTracks()[0];
        if (track) {
          await addVideoTrackToPeers(track, stream);
        }
      } catch (err) {
        console.error('Error opening camera:', err);
        // Fallback mockup
        setIsCameraOn(true);
      }
    }
  }, [isCameraOn, localVideoStream, addVideoTrackToPeers, removeVideoTrackFromPeers]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (localScreenShareStream) {
        localScreenShareStream.getVideoTracks().forEach((track) => {
          removeVideoTrackFromPeers(track);
          track.stop();
        });
      }
      setLocalScreenShareStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setLocalScreenShareStream(stream);
        setIsScreenSharing(true);
        const track = stream.getVideoTracks()[0];
        if (track) {
          await addVideoTrackToPeers(track, stream);
          track.onended = async () => {
            removeVideoTrackFromPeers(track);
            track.stop();
            setIsScreenSharing(false);
            setLocalScreenShareStream(null);
          };
        }
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  }, [isScreenSharing, localScreenShareStream, addVideoTrackToPeers, removeVideoTrackFromPeers]);

  useEffect(() => {
    let activeSocket = null;

    async function onUserJoined(payload) {
      setParticipants((prev) => {
        const next = prev.some((p) => p.socketId === payload.socketId) ? prev : [...prev, payload];
        participantsRef.current = next;
        return next;
      });
    }

    function onUserLeft({ socketId }) {
      setParticipants((prev) => {
        const next = prev.filter((p) => p.socketId !== socketId);
        participantsRef.current = next;
        return next;
      });
      closePeer(socketId);
    }

    async function onSignal({ from, signal }) {
      let pc = peersRef.current.get(from);
      if (!pc && signal.type === 'offer') {
        pc = await createPeerFor({ socketId: from, channelId: signal.channelId, isOfferer: false });
      }
      if (!pc) return;

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit('voice:signal', { to: from, signal: { type: 'answer', sdp: answer } });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
      }
    }

    function onSpeaking({ socketId, userId, speaking }) {
      setSpeakingUsers((prev) => {
        const next = new Set(prev);
        if (speaking) {
          if (socketId) next.add(socketId);
          if (userId) next.add(userId);
        } else {
          if (socketId) next.delete(socketId);
          if (userId) next.delete(userId);
        }
        return next;
      });
    }

    function onStateUpdated({ socketId, userId, muted, deafened, isScreenSharing, isCameraOn, cameraStreamId, screenShareStreamId }) {
      setParticipants((prev) => {
        const next = prev.map((p) =>
          p.socketId === socketId || p.userId === userId
            ? { ...p, muted, deafened, isScreenSharing, isCameraOn, cameraStreamId, screenShareStreamId }
            : p
        );
        participantsRef.current = next;
        return next;
      });
    }

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('voice:user-joined', onUserJoined);
        activeSocket.off('voice:user-left', onUserLeft);
        activeSocket.off('voice:signal', onSignal);
        activeSocket.off('voice:speaking', onSpeaking);
        activeSocket.off('voice:state-updated', onStateUpdated);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('voice:user-joined', onUserJoined);
      socket.on('voice:user-left', onUserLeft);
      socket.on('voice:signal', onSignal);
      socket.on('voice:speaking', onSpeaking);
      socket.on('voice:state-updated', onStateUpdated);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('voice:user-joined', onUserJoined);
        activeSocket.off('voice:user-left', onUserLeft);
        activeSocket.off('voice:signal', onSignal);
        activeSocket.off('voice:speaking', onSpeaking);
        activeSocket.off('voice:state-updated', onStateUpdated);
      }
    };
  }, [createPeerFor, closePeer]);

  // Medir RTT de WebRTC para el indicador de ping
  useEffect(() => {
    if (!activeChannelId) return;
    let cancelled = false;

    async function measurePing() {
      const peers = [...peersRef.current.values()];
      if (peers.length === 0) {
        if (!cancelled) setPingMs(null);
        return;
      }
      let total = 0;
      let count = 0;
      for (const pc of peers) {
        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
              total += report.currentRoundTripTime * 1000;
              count++;
            }
          });
        } catch { /* ignore */ }
      }
      if (!cancelled) setPingMs(count > 0 ? Math.round(total / count) : null);
    }

    measurePing();
    const interval = setInterval(measurePing, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeChannelId, remoteStreamVersion]);

  // Sincronizar estado de silencio/ensordecido/compartiendo pantalla con el servidor
  useEffect(() => {
    if (activeChannelId) {
      getSocket().emit('voice:state-update', {
        channelId: activeChannelId,
        muted,
        deafened,
        isScreenSharing,
        isCameraOn,
        cameraStreamId: localVideoStream?.id || null,
        screenShareStreamId: localScreenShareStream?.id || null,
      });
    }
  }, [activeChannelId, muted, deafened, isScreenSharing, isCameraOn, localVideoStream, localScreenShareStream]);

  // Escuchar cambio de micrófono en caliente
  useEffect(() => {
    async function handleAudioChange() {
      if (!activeChannelId || !localStreamRef.current) return;
      
      const savedAudioId = localStorage.getItem('moonlight:audioInputId');
      const audioConstraints = savedAudioId && savedAudioId !== 'default'
        ? { deviceId: { exact: savedAudioId } }
        : true;
      
      // Parar track viejo antes para liberar el hardware
      const oldTrack = localStreamRef.current.getAudioTracks()[0];
      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }
        
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        const newTrack = newStream.getAudioTracks()[0];
        localStreamRef.current.addTrack(newTrack);
        
        for (const peer of peersRef.current.values()) {
          const senders = peer.getSenders();
          const sender = senders.find(s => s.track && s.track.kind === 'audio');
          if (sender) {
            await sender.replaceTrack(newTrack);
          }
        }
        
        if (speakingDetectorRef.current) {
          speakingDetectorRef.current.audioCtx.close().catch(() => {});
          clearInterval(speakingDetectorRef.current.interval);
          
          try {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(localStreamRef.current);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.3;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            let isSpeaking = false;

            const interval = setInterval(() => {
              analyser.getByteFrequencyData(data);
              const avg = data.reduce((a, b) => a + b, 0) / data.length;
              const nowSpeaking = avg > 8;
              if (nowSpeaking !== isSpeaking) {
                isSpeaking = nowSpeaking;
                getSocket().emit('voice:speaking', { channelId: activeChannelId, speaking: isSpeaking });
                setSpeakingUsers((prev) => {
                  const next = new Set(prev);
                  const selfSocketId = getSocket().id;
                  const selfUserId = session?.user?.id;
                  if (isSpeaking) {
                    if (selfSocketId) next.add(selfSocketId);
                    if (selfUserId) next.add(selfUserId);
                  } else {
                    if (selfSocketId) next.delete(selfSocketId);
                    if (selfUserId) next.delete(selfUserId);
                  }
                  return next;
                });
              }
            }, 100);
            speakingDetectorRef.current = { audioCtx, interval };
          } catch {}
        }
      } catch (err) {
        console.error('Error al cambiar micrófono en caliente:', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const fallbackTrack = fallbackStream.getAudioTracks()[0];
          localStreamRef.current.addTrack(fallbackTrack);
          for (const peer of peersRef.current.values()) {
            const senders = peer.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === 'audio');
            if (sender) {
              await sender.replaceTrack(fallbackTrack);
            }
          }
        } catch {}
      }
    }
    
    window.addEventListener('moonlight:audiochange', handleAudioChange);
    return () => {
      window.removeEventListener('moonlight:audiochange', handleAudioChange);
    };
  }, [activeChannelId]);

  return {
    activeChannelId, participants, muted, deafened, error, pingMs,
    joinChannel, leaveChannel, toggleMute, toggleDeafen,
    remoteStreams: remoteStreamsRef.current, remoteStreamVersion,
    speakingUsers,
    isCameraOn, isScreenSharing, localVideoStream, localScreenShareStream,
    toggleCamera, toggleScreenShare,
    joiningChannelId,
  };
}