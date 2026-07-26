import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';

export const voiceRouter = Router();

voiceRouter.use(requireAuth);

// Configuración ICE para WebRTC. El STUN de Google es gratuito y suficiente
// para que la mayoría de redes domésticas puedan conectar P2P directamente.
// Si en producción detectas que muchas llamadas fallan (redes con NAT
// simétrica, oficinas con firewalls estrictos), añade aquí un servidor TURN
// propio (coturn autohospedado) o de un proveedor (Twilio, Metered) leyendo
// sus credenciales desde variables de entorno.
voiceRouter.get('/ice-servers', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
});
