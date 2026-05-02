const APPIUM_URL = process.env.APPIUM_URL || 'http://host.docker.internal:4726';
const BASE_URL = process.env.BASE_URL || 'http://10.0.2.2:8080';
const ANDROID_DEVICE_NAME = process.env.ANDROID_DEVICE_NAME || 'Android Emulator';
const ANDROID_PLATFORM_VERSION = process.env.ANDROID_PLATFORM_VERSION || '';
const ANDROID_UDID = process.env.ANDROID_UDID || '';

function joinUrl(base, path) {
  return `${base.replace(/\/+$/, '')}${path}`;
}

async function wdRequest(path, method = 'GET', body) {
  const response = await fetch(joinUrl(APPIUM_URL, path), {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.value?.error) {
    const errorText = payload?.value?.message || payload?.message || response.statusText;
    throw new Error(`WebDriver request failed (${method} ${path}): ${errorText}`);
  }
  return payload;
}

async function waitForElement(sessionId, selector, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await wdRequest(`/session/${sessionId}/element`, 'POST', {
        using: 'css selector',
        value: selector,
      });
      const elementId = result?.value?.['element-6066-11e4-a52e-4f735466cecf'];
      if (elementId) return elementId;
    } catch (_error) {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function main() {
  let sessionId = '';
  try {
    const capabilities = {
      platformName: 'Android',
      browserName: 'Chrome',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': ANDROID_DEVICE_NAME,
      'appium:newCommandTimeout': 180,
      'appium:autoGrantPermissions': true,
      'appium:chromedriverAutodownload': true,
      ...(ANDROID_PLATFORM_VERSION ? { 'appium:platformVersion': ANDROID_PLATFORM_VERSION } : {}),
      ...(ANDROID_UDID ? { 'appium:udid': ANDROID_UDID } : {}),
    };

    const session = await wdRequest('/session', 'POST', {
      capabilities: { alwaysMatch: capabilities, firstMatch: [{}] },
    });
    sessionId = session.sessionId || session.value?.sessionId;
    if (!sessionId) throw new Error('Failed to create WebDriver session');

    await wdRequest(`/session/${sessionId}/url`, 'POST', { url: BASE_URL });
    await waitForElement(sessionId, '#map', 30000);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const titleResult = await wdRequest(`/session/${sessionId}/title`);
    const title = titleResult?.value || '';
    if (!title.toLowerCase().includes('nostroots')) {
      throw new Error(`Unexpected title: "${title}"`);
    }

    console.log('Android Emulator smoke test passed');
    console.log(`- Device: ${ANDROID_DEVICE_NAME}`);
    console.log(`- URL: ${BASE_URL}`);
  } finally {
    if (sessionId) {
      await wdRequest(`/session/${sessionId}`, 'DELETE').catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
