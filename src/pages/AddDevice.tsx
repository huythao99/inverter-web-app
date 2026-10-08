import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  Wifi,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Cpu,
  BatteryCharging,
  ExternalLink,
  Globe,
  Send,
  PlayCircle,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { createChargerClaim } from '../services/api';

type SetupStep = 1 | 2 | 3;
type DeviceType = 'inverter' | 'charger';
// 'web': this page sends the WiFi config to the device.
// 'device-page': open the device's own setup page (/connect), same as the app.
type ConnectMethod = 'web' | 'device-page';

const ESP32_IP = '192.168.4.1';
const GUIDE_VIDEO_URL = 'https://youtu.be/8Y0wR_763WI';
// Refetch the charger claim when it has less than this left (TTL ~30 min).
const CLAIM_MIN_LEFT_MS = 3 * 60 * 1000;

// All iOS browsers are WebKit and enforce the same HTTPS->HTTP mixed-content
// block, so they all need a navigation instead of fetch (not just desktop Safari).
function detectManualSetup(): boolean {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isSafari || isIOS;
}

// SSID phát ra bởi AP của từng loại thiết bị
const AP_SSID: Record<DeviceType, string> = {
  inverter: 'GTIControl***',
  charger: 'ChargerControl***',
};

export function AddDevice() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [deviceType, setDeviceType] = useState<DeviceType>('inverter');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOpenNetwork, setIsOpenNetwork] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [safariUrl, setSafariUrl] = useState('');
  const needsManualSetup = detectManualSetup();
  // On iPhone/Safari the device page is the smoother path (no form tab dance).
  const [method, setMethod] = useState<ConnectMethod>(
    needsManualSetup ? 'device-page' : 'web'
  );
  const [devicePageOpened, setDevicePageOpened] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [claim, setClaim] = useState<{ code: string; expiresAt: number } | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState(false);

  const userId = user?.uid || '';
  const apSsid = AP_SSID[deviceType];
  const isCharger = deviceType === 'charger';
  const claimCode = isCharger ? claim?.code : undefined;

  // New charger firmware needs a one-time claim to get its own broker account.
  // Fetch it in step 1, while the browser still has Internet.
  const ensureClaim = useCallback(async () => {
    if (claim && claim.expiresAt - Date.now() > CLAIM_MIN_LEFT_MS) return;
    setClaimLoading(true);
    setClaimError(false);
    try {
      const res = await createChargerClaim();
      const exp = Date.parse(res.expiresAt);
      setClaim({
        code: res.claim,
        expiresAt: Number.isFinite(exp) ? exp : Date.now() + 30 * 60 * 1000,
      });
    } catch {
      setClaimError(true);
    } finally {
      setClaimLoading(false);
    }
  }, [claim]);

  useEffect(() => {
    if (isCharger && currentStep === 1) void ensureClaim();
  }, [isCharger, currentStep, ensureClaim]);

  const devicePageUrl = (() => {
    const q = new URLSearchParams({ uid: userId });
    if (claimCode) q.set('claim', claimCode);
    return `http://${ESP32_IP}/connect?${q.toString()}`;
  })();

  // A link navigation (unlike fetch) is allowed from this https page.
  const openDevicePage = () => {
    window.open(devicePageUrl, '_blank', 'noopener');
    setDevicePageOpened(true);
  };

  const copyDevicePageUrl = async () => {
    try {
      await navigator.clipboard.writeText(devicePageUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // iOS/Safari can't fetch http:// from an https:// page (mixed content).
  // A form POST is a *navigation*, which is allowed, and it produces the POST
  // method the firmware's /wifi route requires. Params stay in the action's
  // query string because the firmware reads them via getParam() (query), not body.
  const submitViaForm = (url: string) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = '_blank';
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const validateWifiCredentials = (): string | null => {
    // SSID validation
    if (!wifiSsid.trim()) {
      return 'Vui lòng nhập tên WiFi';
    }
    if (wifiSsid.length > 32) {
      return 'Tên WiFi không được vượt quá 32 ký tự';
    }
    // Password validation — skipped for open networks (no password)
    if (!isOpenNetwork) {
      if (!wifiPassword) {
        return 'Vui lòng nhập mật khẩu WiFi';
      }
      if (wifiPassword.length < 8) {
        return 'Mật khẩu WiFi phải có ít nhất 8 ký tự';
      }
      if (wifiPassword.length > 63) {
        return 'Mật khẩu WiFi không được vượt quá 63 ký tự';
      }
    }

    return null;
  };


  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkWifiStatus = async (): Promise<string | null> => {
    try {
      const response = await fetch(`http://${ESP32_IP}/wifi-status`, {
        method: 'GET',
        mode: 'cors',
      });
      const status = await response.text();
      return status;
    } catch {
      // CORS error or network error - can't read status
      return null;
    }
  };

  const triggerModeChange = async () => {
    try {
      await fetch(`http://${ESP32_IP}/change-mode-wifi`, {
        method: 'GET',
        mode: 'no-cors',
      });
    } catch {
      // Ignore errors - device may have already switched modes
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('idle');
    setErrorMessage('');

    // Validate WiFi credentials before submitting
    const validationError = validateWifiCredentials();
    if (validationError) {
      setSubmitStatus('error');
      setErrorMessage(validationError);
      return;
    }

    // Open networks send an empty password regardless of any stale field value
    const effectivePassword = isOpenNetwork ? '' : wifiPassword;

    // Build query parameters (matching Flutter app)
    const queryParams = new URLSearchParams({
      ssid: wifiSsid.trim(),
      password: effectivePassword,
      uid: userId,
    });
    // Charger: one-time claim (the charger firmware reads it from /wifi).
    if (claimCode) queryParams.set('claim', claimCode);

    const esp32Url = `http://${ESP32_IP}/wifi?${queryParams.toString()}`;

    // iOS/Safari blocks HTTPS->HTTP fetch (mixed content). The firmware's /wifi
    // route is POST-only, so a pasted/clicked URL (GET) won't match. Submit a
    // form POST (an allowed navigation) instead.
    if (needsManualSetup) {
      submitViaForm(esp32Url);
      setSafariUrl(esp32Url);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create request body
      const bodyData = {
        ssid: wifiSsid.trim(),
        password: effectivePassword,
        uid: userId,
        ...(claimCode ? { claim: claimCode } : {}),
      };

      // Post to ESP32's local IP with both query params and body (matching Flutter app)
      await fetch(esp32Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
        mode: 'no-cors',
      });

      // Wait 6 seconds for ESP32 to connect to WiFi (matching Flutter app)
      await delay(6000);

      // Check WiFi connection status
      const wifiStatus = await checkWifiStatus();

      if (wifiStatus === '3') {
        // WiFi connected successfully - trigger mode change
        await triggerModeChange();
        await delay(5000);
        setSubmitStatus('success');
        setCurrentStep(3);
      } else if (wifiStatus === null) {
        // Could not read status (CORS issue) - assume success since request was sent
        // This is a browser limitation, mobile apps don't have this issue
        setSubmitStatus('success');
        setCurrentStep(3);
      } else {
        // WiFi connection failed
        setSubmitStatus('error');
        setErrorMessage(
          'Thiết bị không thể kết nối WiFi. Vui lòng kiểm tra tên WiFi và mật khẩu.'
        );
      }
    } catch (error) {
      console.error('Failed to configure device:', error);
      setSubmitStatus('error');
      setErrorMessage(
        `Không thể kết nối với thiết bị. Hãy chắc chắn bạn đã kết nối với mạng WiFi "${apSsid}".`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thêm thiết bị mới</h1>
            <p className="text-gray-500">
              Cấu hình thiết bị {deviceType === 'charger' ? 'sạc (charger)' : 'inverter'} của bạn
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step ? <Check className="w-5 h-5" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Step 1: Prepare */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Setup guide video */}
              <a
                href={GUIDE_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 p-4 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
              >
                <div className="p-2 bg-red-50 rounded-full">
                  <PlayCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Xem video hướng dẫn kết nối</p>
                  <p className="text-xs text-gray-500">Các bước thêm thiết bị (YouTube)</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>

              {/* Device type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại thiết bị
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeviceType('inverter')}
                    className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors text-left ${
                      deviceType === 'inverter'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Cpu className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Inverter</p>
                      <p className="text-xs text-gray-500">Hoà lưới</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceType('charger')}
                    className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors text-left ${
                      deviceType === 'charger'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <BatteryCharging className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Charger</p>
                      <p className="text-xs text-gray-500">Bộ sạc</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Bước 1: Kết nối WiFi thiết bị
                </h2>
                <p className="text-gray-500 mt-2">
                  Đầu tiên, kết nối điện thoại/máy tính của bạn với mạng WiFi của thiết bị
                </p>
              </div>

              {isCharger && (
                <div
                  className={`rounded-lg p-3 text-sm border ${
                    claimError
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                >
                  {claimLoading && (
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Đang lấy mã thiết lập bộ sạc...
                    </span>
                  )}
                  {!claimLoading && claim && !claimError && (
                    <span className="flex items-center">
                      <Check className="w-4 h-4 mr-2" />
                      Đã có mã thiết lập bộ sạc (dùng trong 30 phút)
                    </span>
                  )}
                  {!claimLoading && claimError && (
                    <div className="space-y-2">
                      <p>
                        Không lấy được mã thiết lập bộ sạc. Hãy giữ kết nối Internet (chưa vào
                        WiFi thiết bị) rồi thử lại.
                      </p>
                      <button
                        type="button"
                        onClick={() => void ensureClaim()}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* User ID Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID người dùng của bạn (lưu lại cho Bước 2)
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono break-all">
                    {userId}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Sao chép"
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-green-600 text-sm mt-2">Đã sao chép!</p>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">Hướng dẫn:</h3>
                <ol className="list-decimal list-inside space-y-2 text-yellow-700 text-sm">
                  <li>Bật nguồn thiết bị ESP32</li>
                  <li>Mở cài đặt WiFi trên điện thoại/máy tính</li>
                  <li>
                    Kết nối với mạng: <strong>"{apSsid}"</strong>
                  </li>
                  <li>Quay lại trang này sau khi kết nối</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  <strong>Lưu ý:</strong> Trang này hoạt động ngoại tuyến! Sau khi kết nối WiFi thiết bị,
                  bạn sẽ mất internet nhưng trang này vẫn hoạt động.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Tôi đã kết nối {apSsid}
              </button>
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Bước 2: Cấu hình thiết bị
                </h2>
                <p className="text-gray-500 mt-2">
                  Nhập thông tin WiFi nhà bạn để kết nối thiết bị
                </p>
              </div>

              {/* Connection method */}
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'web', icon: Send, title: 'Gửi cấu hình từ web', sub: 'Nhập WiFi tại đây' },
                    { id: 'device-page', icon: Globe, title: 'Mở trang web thiết bị', sub: 'Nhập WiFi trên trang của thiết bị' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors text-left ${
                      method === m.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <m.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {method === 'device-page' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                      <li>
                        Đảm bảo vẫn đang kết nối WiFi <strong>"{apSsid}"</strong>
                      </li>
                      <li>
                        Nhấn <strong>"Mở trang cài đặt thiết bị"</strong> — trang của thiết bị mở ở
                        tab mới
                      </li>
                      <li>Chọn WiFi nhà, nhập mật khẩu rồi nhấn kết nối; trang sẽ báo kết quả</li>
                      <li>
                        Xong thì quay lại đây, nhấn <strong>"Tôi đã hoàn tất"</strong>
                      </li>
                    </ol>
                  </div>

                  {isCharger && !claimCode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      Chưa có mã thiết lập bộ sạc — bộ sạc đời mới có thể không thêm được vào tài
                      khoản. Quay lại Bước 1 khi còn Internet để lấy mã.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={openDevicePage}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Mở trang cài đặt thiết bị
                  </button>

                  <div className="flex items-center space-x-2">
                    <code className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono break-all text-gray-600">
                      {devicePageUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyDevicePageUrl}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      title="Sao chép liên kết"
                    >
                      {linkCopied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Nếu không có tab nào mở ra, sao chép liên kết trên và dán vào trình duyệt. Nếu
                    trang báo không tìm thấy (firmware cũ), hãy dùng cách "Gửi cấu hình từ web".
                  </p>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!devicePageOpened}
                      onClick={() => {
                        setSubmitStatus('success');
                        setCurrentStep(3);
                      }}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Tôi đã hoàn tất
                    </button>
                  </div>
                </div>
              )}

              {method === 'web' && (<>
              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
              )}

              {safariUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-blue-800 font-medium">
                    Đã gửi cấu hình tới thiết bị. Một tab mới sẽ hiển thị kết quả từ thiết bị.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                    <li>Kiểm tra tab mới vừa mở — thiết bị sẽ báo đã nhận cấu hình</li>
                    <li>Nếu không có tab nào mở ra, nhấn <strong>"Gửi lại cấu hình"</strong></li>
                    <li>Sau đó quay lại đây và nhấn <strong>"Tôi đã hoàn tất"</strong></li>
                  </ol>

                  <button
                    type="button"
                    onClick={() => submitViaForm(safariUrl)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    Gửi lại cấu hình
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSafariUrl('');
                      setSubmitStatus('success');
                      setCurrentStep(3);
                    }}
                    className="w-full py-2 text-blue-600 text-sm hover:underline"
                  >
                    Tôi đã hoàn tất → Tiếp tục
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên WiFi nhà (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập tên WiFi nhà bạn"
                    required
                    maxLength={32}
                  />
                </div>

                {!isOpenNetwork && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mật khẩu WiFi
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                        placeholder="Nhập mật khẩu WiFi"
                        required
                        minLength={8}
                        maxLength={63}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOpenNetwork}
                    onChange={(e) => setIsOpenNetwork(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Mạng mở (không mật khẩu)
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID người dùng
                  </label>
                  <input
                    type="text"
                    value={userId}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Liên kết thiết bị với tài khoản của bạn
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Đang cấu hình...
                      </>
                    ) : (
                      'Cấu hình thiết bị'
                    )}
                  </button>
                </div>
              </form>
              </>)}
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Đã gửi cấu hình!
                </h2>
                <p className="text-gray-500 mt-2">
                  Thiết bị đang kết nối với WiFi nhà bạn
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <h3 className="font-medium text-gray-900 mb-2">Tiếp theo:</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
                  <li>Thiết bị sẽ khởi động lại và kết nối WiFi nhà bạn</li>
                  <li>Thiết bị sẽ đăng ký với máy chủ</li>
                  <li>Thiết bị sẽ xuất hiện trên bảng điều khiển trong 1-2 phút</li>
                  <li>Kết nối lại điện thoại/máy tính với WiFi nhà bạn</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  <strong>Lưu ý:</strong> Kết nối lại với mạng WiFi nhà để truy cập bảng điều khiển.
                </p>
              </div>

              <Link
                to="/"
                className="inline-block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Đi đến Bảng điều khiển
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
