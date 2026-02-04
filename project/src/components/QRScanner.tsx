import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, Loader2, Check, RotateCcw, Keyboard, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  language?: 'en' | 'th';
}

type ScannerState = 'initializing' | 'requesting_permission' | 'selecting_camera' | 'preparing_ui' | 'starting' | 'scanning' | 'error';
type ErrorType = 'permission_denied' | 'permission_dismissed' | 'no_camera' | 'camera_in_use' | 'not_supported' | 'https_required' | 'start_failed' | 'ui_not_ready' | 'unknown';

interface CameraDevice {
  deviceId: string;
  label: string;
  isRear: boolean;
  score: number;
}

interface DebugLog {
  time: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

const READER_ELEMENT_ID = 'qr-reader-container';

export function QRScanner({ onScan, onClose, language = 'en' }: QRScannerProps) {
  const [state, setState] = useState<ScannerState>('initializing');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingCameraId, setPendingCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);
  const readerContainerRef = useRef<HTMLDivElement>(null);

  const log = useCallback((message: string, type: DebugLog['type'] = 'info') => {
    const entry: DebugLog = {
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    setDebugLogs(prev => [...prev.slice(-19), entry]);
    if (type === 'error') {
      console.error(`[QRScanner] ${message}`);
    } else if (type === 'warn') {
      console.warn(`[QRScanner] ${message}`);
    } else {
      console.log(`[QRScanner] ${message}`);
    }
  }, []);

  const messages = {
    en: {
      title: 'Scan Customer QR Code',
      positioning: 'Position the QR code within the frame',
      initializing: 'Initializing scanner...',
      requesting_permission: 'Requesting camera permission...',
      selecting_camera: 'Detecting cameras...',
      preparing_ui: 'Preparing camera view...',
      starting: 'Starting camera...',
      permission_denied: 'Camera access was denied. Please allow camera access in your browser settings, then tap "Retry".',
      permission_dismissed: 'Camera permission prompt was dismissed. Please tap "Retry" and allow camera access.',
      no_camera: 'No camera found on this device. Use manual entry instead.',
      camera_in_use: 'Camera is being used by another app. Close other camera apps and tap "Retry".',
      not_supported: 'Camera not supported on this browser. Try Chrome or Safari.',
      https_required: 'Camera requires a secure HTTPS connection.',
      start_failed: 'Failed to start camera. Try selecting a different camera or use manual entry.',
      ui_not_ready: 'Scanner UI not ready yet. Please wait a moment...',
      unknown: 'An unexpected error occurred. Please try again.',
      retry: 'Retry',
      switchCamera: 'Switch Camera',
      manualEntry: 'Enter Code Manually',
      enterCode: 'Enter QR code or VIP ID',
      submit: 'Look Up',
      cancel: 'Back to Camera',
      close: 'Close',
      showDebug: 'Show Debug Info',
      hideDebug: 'Hide Debug',
      cameraLabel: 'Camera:',
      rearCamera: 'Rear Camera',
      frontCamera: 'Front Camera',
      unknownCamera: 'Camera',
    },
    th: {
      title: 'สแกน QR Code ลูกค้า',
      positioning: 'วาง QR Code ภายในกรอบ',
      initializing: 'กำลังเริ่มต้น...',
      requesting_permission: 'กำลังขออนุญาตใช้กล้อง...',
      selecting_camera: 'กำลังตรวจหากล้อง...',
      preparing_ui: 'กำลังเตรียมกล้อง กรุณารอสักครู่...',
      starting: 'กำลังเปิดกล้อง...',
      permission_denied: 'การเข้าถึงกล้องถูกปฏิเสธ กรุณาอนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์ แล้วกด "ลองใหม่"',
      permission_dismissed: 'ปิดหน้าต่างขออนุญาตกล้องแล้ว กรุณากด "ลองใหม่" และอนุญาตการใช้กล้อง',
      no_camera: 'ไม่พบกล้องในอุปกรณ์นี้ กรุณาใช้การกรอกรหัสแทน',
      camera_in_use: 'กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปอื่นที่ใช้กล้องและกด "ลองใหม่"',
      not_supported: 'เบราว์เซอร์นี้ไม่รองรับกล้อง กรุณาใช้ Chrome หรือ Safari',
      https_required: 'กล้องต้องการการเชื่อมต่อ HTTPS ที่ปลอดภัย',
      start_failed: 'ไม่สามารถเปิดกล้องได้ ลองเลือกกล้องอื่นหรือใช้การกรอกรหัส',
      ui_not_ready: 'กำลังเตรียมกล้อง กรุณารอสักครู่...',
      unknown: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      retry: 'ลองใหม่',
      switchCamera: 'เปลี่ยนกล้อง',
      manualEntry: 'กรอกรหัสเอง',
      enterCode: 'กรอก QR code หรือ VIP ID',
      submit: 'ค้นหา',
      cancel: 'กลับไปใช้กล้อง',
      close: 'ปิด',
      showDebug: 'แสดงข้อมูลดีบัก',
      hideDebug: 'ซ่อนดีบัก',
      cameraLabel: 'กล้อง:',
      rearCamera: 'กล้องหลัง',
      frontCamera: 'กล้องหน้า',
      unknownCamera: 'กล้อง',
    }
  };

  const msg = messages[language];

  const detectRearCamera = (label: string): { isRear: boolean; score: number } => {
    const lowerLabel = label.toLowerCase();
    let score = 0;
    let isRear = false;

    const rearKeywords = ['back', 'rear', 'environment', 'main', 'wide', 'ultra', 'primary', '0,', 'camera 0', 'facing back'];
    const frontKeywords = ['front', 'user', 'selfie', 'face', 'facetime', 'facing front'];
    const avoidKeywords = ['ir', 'infrared', 'depth', 'tof', 'auxiliary'];

    for (const keyword of avoidKeywords) {
      if (lowerLabel.includes(keyword)) {
        return { isRear: false, score: -100 };
      }
    }

    for (const keyword of rearKeywords) {
      if (lowerLabel.includes(keyword)) {
        score += 10;
        isRear = true;
      }
    }

    for (const keyword of frontKeywords) {
      if (lowerLabel.includes(keyword)) {
        score -= 15;
        isRear = false;
      }
    }

    if (lowerLabel.includes('camera2 0') || lowerLabel.includes('camera 0')) {
      score += 20;
      isRear = true;
    }

    if (score === 0 && !isRear) {
      score = 5;
      isRear = true;
    }

    return { isRear, score };
  };

  const enumerateCameras = useCallback(async (): Promise<CameraDevice[]> => {
    log('Enumerating cameras...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      log('MediaDevices API not available', 'error');
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      log(`Found ${videoDevices.length} video input device(s)`);

      const cameraList: CameraDevice[] = videoDevices.map((device, index) => {
        const { isRear, score } = detectRearCamera(device.label || `Camera ${index}`);
        const camera: CameraDevice = {
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          isRear,
          score
        };
        log(`Camera ${index}: "${camera.label}" (rear=${isRear}, score=${score})`);
        return camera;
      });

      cameraList.sort((a, b) => b.score - a.score);

      return cameraList;
    } catch (err) {
      log(`Camera enumeration failed: ${err}`, 'error');
      return [];
    }
  }, [log]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    log('Requesting camera permission...');
    setState('requesting_permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      log('Permission granted, stopping test stream', 'success');
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      const errorName = error?.name || 'Unknown';
      const errorMessage = error?.message || '';

      log(`Permission request failed: ${errorName} - ${errorMessage}`, 'error');

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        if (errorMessage.includes('dismissed') || errorMessage.includes('denied')) {
          setErrorType('permission_dismissed');
        } else {
          setErrorType('permission_denied');
        }
      } else if (errorName === 'NotFoundError') {
        setErrorType('no_camera');
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        setErrorType('camera_in_use');
      } else if (errorName === 'NotSupportedError' || errorName === 'TypeError') {
        setErrorType('not_supported');
      } else {
        setErrorType('unknown');
      }

      setErrorDetail(`${errorName}: ${errorMessage}`);
      return false;
    }
  }, [log]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scannerState = scannerRef.current.getState();
        if (scannerState === 2) {
          await scannerRef.current.stop();
          log('Scanner stopped successfully');
        }
      } catch (err) {
        log(`Error stopping scanner: ${err}`, 'warn');
      }
      scannerRef.current = null;
    }
  }, [log]);

  const waitForElement = useCallback((maxAttempts = 30): Promise<HTMLElement | null> => {
    return new Promise((resolve) => {
      let attempts = 0;

      const check = () => {
        if (!mountedRef.current) {
          resolve(null);
          return;
        }

        const element = document.getElementById(READER_ELEMENT_ID);
        if (element) {
          log(`Reader element found after ${attempts} attempt(s)`, 'success');
          resolve(element);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          log(`Reader element not found after ${maxAttempts} attempts`, 'error');
          resolve(null);
          return;
        }

        log(`Waiting for reader element... attempt ${attempts}/${maxAttempts}`);
        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    });
  }, [log]);

  const startScanner = useCallback(async (deviceId: string) => {
    if (!mountedRef.current) return;

    await stopScanner();

    setState('starting');
    log(`Starting scanner with device: ${deviceId}`);

    const readerElement = await waitForElement();

    if (!readerElement) {
      if (!mountedRef.current) return;
      log('Reader element not found, cannot start scanner', 'error');
      setErrorType('ui_not_ready');
      setErrorDetail('Scanner container element not found in DOM');
      setState('error');
      return;
    }

    try {
      const scanner = new Html5Qrcode(READER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      const onSuccess = (decodedText: string) => {
        if (!scannedRef.current && mountedRef.current) {
          scannedRef.current = true;
          log(`QR Code decoded: ${decodedText}`, 'success');
          onScan(decodedText);
        }
      };

      log(`Using explicit deviceId: ${deviceId}`);
      await scanner.start(
        deviceId,
        config,
        onSuccess,
        () => {}
      );

      if (mountedRef.current) {
        setState('scanning');
        log('Scanner started successfully', 'success');
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      const errorName = error?.name || 'Unknown';
      const errorMessage = error?.message || String(err);

      log(`Scanner start failed: ${errorName} - ${errorMessage}`, 'error');

      if (!mountedRef.current) return;

      if (errorName === 'NotAllowedError' || errorMessage.includes('Permission')) {
        setErrorType('permission_denied');
      } else if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
        setErrorType('no_camera');
      } else if (errorName === 'NotReadableError' || errorMessage.includes('in use') || errorMessage.includes('Could not start')) {
        setErrorType('camera_in_use');
      } else {
        setErrorType('start_failed');
      }

      setErrorDetail(errorMessage);
      setState('error');
    }
  }, [log, onScan, stopScanner, waitForElement]);

  const initialize = useCallback(async () => {
    if (!mountedRef.current) return;

    log('=== Scanner Initialization Started ===');
    log(`User Agent: ${navigator.userAgent}`);
    log(`Secure Context: ${window.isSecureContext}`);
    log(`Protocol: ${window.location.protocol}`);

    setState('initializing');
    setErrorType(null);
    setErrorDetail('');
    scannedRef.current = false;
    setPendingCameraId(null);

    if (!window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      log('HTTPS required but not available', 'error');
      setErrorType('https_required');
      setState('error');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log('getUserMedia not supported', 'error');
      setErrorType('not_supported');
      setState('error');
      return;
    }

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setState('error');
      return;
    }

    if (!mountedRef.current) return;

    setState('selecting_camera');
    const detectedCameras = await enumerateCameras();

    if (!mountedRef.current) return;

    if (detectedCameras.length === 0) {
      log('No cameras found after enumeration', 'error');
      setErrorType('no_camera');
      setState('error');
      return;
    }

    setCameras(detectedCameras);

    const bestCamera = detectedCameras[0];
    log(`Selected best camera: "${bestCamera.label}" (score=${bestCamera.score})`);
    setSelectedCamera(bestCamera.deviceId);

    setState('preparing_ui');
    setPendingCameraId(bestCamera.deviceId);
  }, [log, requestCameraPermission, enumerateCameras]);

  useEffect(() => {
    if (state === 'preparing_ui' && pendingCameraId) {
      log('UI ready, starting scanner...');
      startScanner(pendingCameraId);
      setPendingCameraId(null);
    }
  }, [state, pendingCameraId, startScanner, log]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    log(`Retry attempt ${retryCount + 1}`);
    initialize();
  }, [initialize, retryCount, log]);

  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex(c => c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    log(`Switching to camera: "${nextCamera.label}"`);
    setSelectedCamera(nextCamera.deviceId);

    await startScanner(nextCamera.deviceId);
  }, [cameras, selectedCamera, log, startScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (code) {
      log(`Manual code submitted: ${code}`);
      onScan(code);
    }
  };

  const handleClose = useCallback(async () => {
    log('Closing scanner');
    mountedRef.current = false;
    await stopScanner();
    onClose();
  }, [stopScanner, onClose, log]);

  useEffect(() => {
    mountedRef.current = true;
    initialize();

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  const getStatusMessage = () => {
    switch (state) {
      case 'initializing': return msg.initializing;
      case 'requesting_permission': return msg.requesting_permission;
      case 'selecting_camera': return msg.selecting_camera;
      case 'preparing_ui': return msg.preparing_ui;
      case 'starting': return msg.starting;
      default: return '';
    }
  };

  const getErrorMessage = () => {
    if (!errorType) return '';
    return msg[errorType] || msg.unknown;
  };

  const getCurrentCameraLabel = () => {
    const camera = cameras.find(c => c.deviceId === selectedCamera);
    if (!camera) return '';
    if (camera.isRear) return msg.rearCamera;
    return msg.frontCamera;
  };

  const showVideoContainer = state === 'preparing_ui' || state === 'starting' || state === 'scanning';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-white" />
          <h2 className="text-lg font-bold text-white">{msg.title}</h2>
        </div>
        <button
          onClick={handleClose}
          className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          aria-label={msg.close}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {showManualInput ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-gray-900">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {msg.enterCode}
                  </label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="JOKO-XXXX / VIP001"
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualCode('');
                      if (state === 'error') {
                        handleRetry();
                      }
                    }}
                    className="flex-1 px-4 py-3 text-gray-700 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {msg.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {msg.submit}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : state === 'error' ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-gray-900">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-red-700 font-semibold text-lg mb-2">
                {language === 'en' ? 'Camera Error' : 'ข้อผิดพลาดกล้อง'}
              </p>
              <p className="text-gray-600 mb-6">{getErrorMessage()}</p>

              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full px-4 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {msg.retry}
                </button>

                <button
                  onClick={() => setShowManualInput(true)}
                  className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Keyboard className="w-5 h-5" />
                  {msg.manualEntry}
                </button>
              </div>

              {errorDetail && (
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="mt-4 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showDebug ? msg.hideDebug : msg.showDebug}
                </button>
              )}

              {showDebug && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-left">
                  <p className="text-xs font-mono text-gray-600 break-all">{errorDetail}</p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {debugLogs.slice(-10).map((logEntry, i) => (
                      <p key={i} className={`text-xs font-mono ${
                        logEntry.type === 'error' ? 'text-red-600' :
                        logEntry.type === 'warn' ? 'text-yellow-600' :
                        logEntry.type === 'success' ? 'text-green-600' :
                        'text-gray-500'
                      }`}>
                        {logEntry.time}: {logEntry.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : showVideoContainer ? (
          <>
            <div className="flex-1 relative bg-black">
              <div
                id={READER_ELEMENT_ID}
                ref={readerContainerRef}
                className="w-full h-full"
              />

              {(state === 'preparing_ui' || state === 'starting') && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium">{getStatusMessage()}</p>
                  </div>
                </div>
              )}

              {state === 'scanning' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-4 border-white/50 rounded-2xl relative">
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-xl" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-900 px-4 py-4 space-y-3 shrink-0">
              {state === 'scanning' && (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">{msg.positioning}</span>
                </div>
              )}

              {selectedCamera && cameras.length > 0 && (
                <div className="text-center text-xs text-gray-400">
                  {msg.cameraLabel} {getCurrentCameraLabel()}
                </div>
              )}

              <div className="flex gap-3">
                {cameras.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    disabled={state !== 'scanning'}
                    className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {msg.switchCamera}
                  </button>
                )}
                <button
                  onClick={() => setShowManualInput(true)}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Keyboard className="w-4 h-4" />
                  {msg.manualEntry}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">{getStatusMessage()}</p>
              <p className="text-gray-400 text-sm mt-2">
                {language === 'en' ? 'Please wait...' : 'กรุณารอสักครู่...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
