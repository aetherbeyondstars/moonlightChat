import { useEffect, useRef } from 'react';

export function StarryBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuración de animación de lluvia de estrellas
    const opciones = {
      cantidadObjetivo: 1200,
      cantidadMovilMax: 600,
      velocidadBase: 0.05,
      vidaFrames: 300,
      direccion: { x: -0.5, y: 1 },
      tamaño: [2, 2],
      opacidadMax: 1,
      colorRGB: '255, 255, 255',
      colorAleatorio: false,
      aceleracionRange: [5, 40],
    };

    if (window.innerWidth < 520) {
      opciones.cantidadObjetivo = Math.min(opciones.cantidadMovilMax, opciones.cantidadObjetivo);
    }

    let chispas = [];
    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    let rafId = null;

    function ajustarCanvas() {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
    }

    function aleatorio(min, max) {
      return Math.random() * (max - min) + min;
    }
    function enteroAleatorio(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function Particula(x, y) {
      this.x = x;
      this.y = y;
      this.edad = 0;
      this.acel = aleatorio(opciones.aceleracionRange[0], opciones.aceleracionRange[1]);
      this.color = opciones.colorAleatorio
        ? `${enteroAleatorio(0, 255)}, ${enteroAleatorio(0, 255)}, ${enteroAleatorio(0, 255)}`
        : opciones.colorRGB;
      this.opacidad = opciones.opacidadMax;
      this.ancho = opciones.tamaño[0];
      this.alto = opciones.tamaño[1];
    }

    Particula.prototype.actualizar = function () {
      this.x += opciones.velocidadBase * opciones.direccion.x * (this.acel / 2);
      this.y += opciones.velocidadBase * opciones.direccion.y * (this.acel / 2);
      this.edad += 1;
      this.opacidad = opciones.opacidadMax - this.edad / opciones.vidaFrames;
    };

    function crearParticulaAleatoria() {
      const x = aleatorio(-200, cssW + 200);
      const y = aleatorio(-200, cssH + 200);
      chispas.push(new Particula(x, y));
    }

    function dibujarParticula(p) {
      p.actualizar();
      const op = Math.max(0, Math.min(1, p.opacidad));
      ctx.fillStyle = `rgba(${p.color}, ${op})`;
      ctx.fillRect(p.x, p.y, p.ancho, p.alto);
    }

    function bucle() {
      ctx.clearRect(0, 0, cssW, cssH);
      for (let i = chispas.length - 1; i >= 0; i--) {
        const p = chispas[i];
        dibujarParticula(p);
        if (p.edad >= opciones.vidaFrames || p.opacidad <= 0) {
          chispas.splice(i, 1);
        }
      }
      if (chispas.length < opciones.cantidadObjetivo) {
        crearParticulaAleatoria();
      }
      rafId = requestAnimationFrame(bucle);
    }

    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);
    rafId = requestAnimationFrame(bucle);

    return () => {
      window.removeEventListener('resize', ajustarCanvas);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="cieloEstrellado"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
