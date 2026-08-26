import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Flashlight, AlertCircle, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedCode: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isDetected, setIsDetected] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // Helper to extract clean party code from QR content
  const extractPartyCode = useCallback((raw: string): string => {
    const trimmed = raw.trim();
    try {
      // 1. Check if it's a URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('?')) {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `http://dummy.com/${trimmed}`);
        const joinParam = url.searchParams.get('join') || url.searchParams.get('code') || url.searchParams.get('room');
        if (joinParam) {
          return joinParam.trim().toUpperCase();
        }
      }
    } catch {}

    // 2. Check JSON payload like {"code":"HYP42"}
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.code || parsed.join || parsed.room) {
          return String(parsed.code || parsed.join || parsed.room).trim().toUpperCase();
        }
      }
    } catch {}

    // 3. Fallback: match 4-7 alphanumeric characters (e.g. HYP42, LOCAL, NEO99)
    const match = trimmed.match(/[A-Za-z0-9]{3,8}/);
    if (match) {
      return match[0].toUpperCase();
    }

    return trimmed.toUpperCase();
  }, []);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);
    setIsDetected(false);
    setDetectedCode(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setErrorMessage('Camera API is not supported in this browser. Please enter Party Code manually.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
        if (capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        startScanLoop();
      }
    } catch (err: any) {
      console.warn('[QRScanner] Camera access error:', err);
      setHasPermission(false);
      const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      if (isHttp) {
        setErrorMessage('Camera access requires HTTPS or localhost on mobile. Please enter the Party Code below!');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access in browser settings or enter code below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera found on this device. Please enter Party Code below.');
      } else {
        setErrorMessage(`Camera unavailable (${err.message || 'Permission needed'}). Please enter code below!`);
      }
    }
  }, [facingMode, stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
        soundManager.playClick(1000);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Flip camera between environment (back) and user (front)
  const flipCamera = () => {
    soundManager.playClick(900);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle successful code detection
  const handleCodeFound = useCallback(
    (codeText: string) => {
      const partyCode = extractPartyCode(codeText);
      if (!partyCode) return;

      setIsDetected(true);
      setDetectedCode(partyCode);

      // Play success chime & haptic
      soundManager.playPowerup(600);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 30, 80]);
        } catch {}
      }

      stopCamera();

      // Delay briefly for user to see visual confirmation, then trigger join
      setTimeout(() => {
        onScanSuccess(partyCode);
        onClose();
      }, 700);
    },
    [extractPartyCode, onClose, onScanSuccess, stopCamera]
  );

  // Scan loop using Native BarcodeDetector (fastest) with jsQR fallback
  const startScanLoop = useCallback(() => {
    // Check if native BarcodeDetector is available
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector: any = null;
    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {}
    }

    let lastScanTime = 0;

    const scanFrame = async (timestamp: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Throttle scanning to every 80ms for buttery 60fps UI performance without CPU pegging
      if (timestamp - lastScanTime > 80) {
        lastScanTime = timestamp;

        try {
          // 1. Try Hardware-accelerated BarcodeDetector
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              if (rawValue) {
                handleCodeFound(rawValue);
                return;
              }
            }
          }
        } catch {}

        // 2. jsQR Fallback (Works on every browser, iOS Safari, Android Chrome, WebView)
        try {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            const targetWidth = Math.min(480, video.videoWidth || 480);
            const targetHeight = Math.floor(targetWidth * ((video.videoHeight || 360) / (video.videoWidth || 480)));

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth;
              canvas.height = targetHeight;
            }

            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (qrCode && qrCode.data) {
              handleCodeFound(qrCode.data);
              return;
            }
          }
        } catch {}
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [handleCodeFound]);

  // Lifecycle when modal opens/closes or facing mode flips
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-md bg-arcade-surface/95 border-2 border-arcade-cyan/60 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,229,255,0.3)] overflow-hidden flex flex-col space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-arcade-cyan/20 border border-arcade-cyan/50 text-arcade-cyan flex items-center justify-center shadow-glow-cyan">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-arcade text-sm sm:text-base text-arcade-cream">
                  SCAN TV QR CODE
                </h3>
                <p className="text-[10px] font-mono text-arcade-cyan">POINT CAMERA AT HOST DISPLAY</p>
              </div>
            </div>

            <button
              onClick={() => {
                soundManager.playClick(700);
                onClose();
              }}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Viewport / Scanning Region */}
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border-2 border-arcade-cyan/40 shadow-inner flex items-center justify-center">
            {/* Hidden Processing Canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Feed */}
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Error or No Permission State */}
            {hasPermission === false && (
              <div className="relative z-20 p-6 text-center space-y-3 bg-black/90 max-w-xs rounded-2xl border border-arcade-crimson/40">
                <AlertCircle className="w-10 h-10 text-arcade-crimson mx-auto" />
                <p className="font-mono text-xs text-arcade-cream leading-relaxed">{errorMessage}</p>
                <button
                  onClick={() => startCamera()}
                  className="px-4 py-2 rounded-xl bg-arcade-crimson/20 border border-arcade-crimson text-arcade-crimson text-xs font-mono font-bold hover:bg-arcade-crimson/30 transition-all flex items-center gap-1.5 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> RETRY CAMERA
                </button>
              </div>
            )}

            {/* Scanner Target Frame & Laser Animation */}
            {hasPermission === true && !isDetected && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Target box */}
                <div className="relative w-3/4 h-3/4 border-2 border-arcade-cyan/80 rounded-2xl shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                  {/* Corner Accent Brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-arcade-amber rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-arcade-amber rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-arcade-amber rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-arcade-amber rounded-br-lg" />

                  {/* Animated Horizontal Laser Scan Line */}
                  <motion.div
                    animate={{
                      y: ['0%', '100%', '0%'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      ease: 'easeInOut',
                    }}
                    className="w-full h-1 bg-gradient-to-r from-transparent via-arcade-cyan to-transparent shadow-[0_0_15px_#00E5FF]"
                  />
                </div>

                {/* Subtle scanning prompt */}
                <div className="absolute bottom-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono text-arcade-cream flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-arcade-amber animate-spin" />
                  <span>ALIGN QR CODE INSIDE FRAME</span>
                </div>
              </div>
            )}

            {/* Success Detection Overlay */}
            {isDetected && detectedCode && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 z-30 bg-green-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3"
              >
                <CheckCircle2 className="w-16 h-16 text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.9)]" />
                <span className="font-arcade text-sm text-green-300">PARTY CODE DETECTED!</span>
                <span className="font-arcade text-4xl text-white font-black tracking-widest px-4 py-2 rounded-2xl bg-black/60 border border-green-400 shadow-glow-mint">
                  {detectedCode}
                </span>
                <span className="text-xs font-mono text-green-300 animate-pulse">CONNECTING CONTROLLER...</span>
              </motion.div>
            )}

            {/* In-viewport Controls: Torch & Camera Flip */}
            {hasPermission === true && !isDetected && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                      torchOn
                        ? 'bg-arcade-amber text-black border-arcade-amber shadow-glow-amber'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                    title="Toggle Flashlight"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={flipCamera}
                  className="p-2 rounded-xl bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md transition-all"
                  title="Flip Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Manual Code Input Fallback Option */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <span className="text-[10px] font-mono text-arcade-cream-muted uppercase tracking-wider block text-center">
              OR TYPE CODE MANUALLY
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. HYP42"
                maxLength={7}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/50 border border-white/20 text-center font-arcade text-base tracking-widest text-arcade-amber uppercase focus:outline-none focus:border-arcade-cyan"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim()) {
                    handleCodeFound(manualCode.trim());
                  }
                }}
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-arcade-cyan hover:bg-arcade-cyan/90 disabled:opacity-40 text-black font-arcade text-xs font-black transition-all flex items-center gap-1"
              >
                <span>ENTER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
