import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VideoPlayer({ src, className }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarRef = useRef(null);

  // Ocultar controles automáticamente al estar inactivo
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Control del arrastre (scrubbing)
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      const video = videoRef.current;
      const progressBar = progressBarRef.current;
      if (!video || !progressBar || !duration) return;

      const rect = progressBar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const newTime = (clickX / rect.width) * duration;
      
      video.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, duration]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={cn(
        "group relative max-w-sm max-h-80 rounded-lg overflow-hidden border border-border/40 bg-black flex items-center justify-center select-none",
        isFullscreen && "max-w-none max-h-none w-screen h-screen rounded-none border-0",
        className
      )}
    >
      <video
        ref={videoRef}
        src={src}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className={cn(
          "w-full h-full max-h-80 cursor-pointer object-contain bg-black/40",
          isFullscreen && "max-h-none w-screen h-screen bg-black"
        )}
      />

      {/* Botón central de Play cuando está pausado */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 hover:scale-110 hover:bg-black/80 transition-all duration-200 shadow-2xl z-10"
        >
          <Play className="h-6 w-6 fill-white text-white" />
        </button>
      )}

      {/* Barra de controles inferior */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 transition-all duration-300 ease-in-out z-20",
          showControls || !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        {/* Barra de progreso */}
        <div
          ref={progressBarRef}
          onMouseDown={(e) => {
            setIsScrubbing(true);
            const video = videoRef.current;
            if (!video || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newTime = (clickX / rect.width) * duration;
            video.currentTime = newTime;
            setCurrentTime(newTime);
          }}
          className={cn(
            "group/progress relative w-full rounded-full bg-white/20 cursor-pointer flex items-center transition-all duration-150",
            isScrubbing ? "h-1.5" : "h-1 hover:h-1.5"
          )}
        >
          <div
            className="h-full rounded-full bg-dynamic-accent transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className={cn(
              "absolute h-3 w-3 rounded-full bg-white border border-dynamic-accent shadow-md transition-opacity duration-150",
              isScrubbing ? "opacity-100 scale-110" : "opacity-0 group-hover/progress:opacity-100"
            )}
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        {/* Fila de controles y botones */}
        <div className="flex items-center justify-between text-white/90">
          <div className="flex items-center gap-4">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="hover:text-dynamic-accent active:scale-90 transition-all duration-150"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            {/* Contador de tiempo */}
            <span className="text-[11px] font-semibold tracking-wider font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Control de volumen deslizante */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                className="hover:text-dynamic-accent active:scale-90 transition-all duration-150"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 overflow-hidden group-hover/volume:w-16 h-1 rounded bg-white/30 accent-dynamic-accent transition-all duration-300 cursor-pointer"
                style={{
                  accentColor: 'hsl(var(--dynamic-accent))'
                }}
              />
            </div>

            {/* Pantalla completa */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-dynamic-accent active:scale-90 transition-all duration-150"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
