const APPIUM_URL = process.env.APPIUM_URL || 'http://host.docker.internal:4723';
const BASE_URL = process.env.BASE_URL || 'http://host.docker.internal:8080';
const IOS_DEVICE_NAME = process.env.IOS_DEVICE_NAME || 'iPhone 17 Pro';
const IOS_PLATFORM_VERSION = process.env.IOS_PLATFORM_VERSION || '26.0';
const IOS_UDID = process.env.IOS_UDID || '';

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

async function waitForElement(sessionId, selector, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await wdRequest(`/session/${sessionId}/element`, 'POST', {
        using: 'css selector',
        value: selector,
      });
      const elementId = result?.value?.['element-6066-11e4-a52e-4f735466cecf'];
      if (elementId) return elementId;
    } catch (_error) {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function main() {
  let sessionId = '';
  try {
    const capabilities = {
      platformName: 'iOS',
      browserName: 'Safari',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': IOS_DEVICE_NAME,
      'appium:platformVersion': IOS_PLATFORM_VERSION,
      'appium:newCommandTimeout': 180,
      'appium:showXcodeLog': true,
      'appium:wdaLaunchTimeout': 300000,
      'appium:wdaConnectionTimeout': 300000,
      'appium:wdaStartupRetries': 4,
      'appium:wdaStartupRetryInterval': 10000,
      'appium:webviewConnectTimeout': 120000,
      'appium:includeSafariInWebviews': true,
      ...(IOS_UDID ? { 'appium:udid': IOS_UDID } : {}),
    };

    const session = await wdRequest('/session', 'POST', {
      capabilities: { alwaysMatch: capabilities, firstMatch: [{}] },
    });
    sessionId = session.sessionId || session.value?.sessionId;
    if (!sessionId) throw new Error('Failed to create WebDriver session');

    await wdRequest(`/session/${sessionId}/url`, 'POST', { url: BASE_URL });
    await waitForElement(sessionId, '#map', 20000);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const titleResult = await wdRequest(`/session/${sessionId}/title`);
    const title = titleResult?.value || '';
    if (!title || !title.toLowerCase().includes('nostroots')) {
      throw new Error(`Unexpected page title: "${title}"`);
    }

    const statusResult = await wdRequest(`/session/${sessionId}/execute/sync`, 'POST', {
      script: `
        const c = document.getElementById('status-container');
        if (!c) return '';
        const active = c.querySelector('.status-message');
        return active ? (active.textContent || '') : '';
      `,
      args: [],
    });
    const statusText = String(statusResult?.value || '');
    if (statusText.includes('Error initializing map')) {
      throw new Error('WebGL map initialization error detected on iOS Simulator');
    }

    console.log('iOS Simulator smoke test passed');
    console.log(`- Device: ${IOS_DEVICE_NAME}`);
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
