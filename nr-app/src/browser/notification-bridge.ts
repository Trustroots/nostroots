export function createNotificationBridgeInjectionScript(): string {
  return `
(function () {
  window.nostrootsBrowser = window.nostrootsBrowser || {};
  if (window.nostrootsBrowser.notifications && window.nostrootsBrowser.notifications.__native) return true;

  function state() {
    return Promise.resolve({
      available: false,
      enabled: false,
      hasToken: false,
      token: '',
      environment: '',
      topic: '',
      subscribedPlusCodes: [],
      lastPublishedAt: 0,
      lastError: 'Native push notifications are not implemented in the nr-app NIP-07 browser yet.'
    });
  }

  window.nostrootsBrowser.notifications = {
    __native: true,
    getState: state,
    enable: state,
    disable: state,
    subscribePlusCode: state,
    unsubscribePlusCode: state,
    sendTestNotification: state
  };

  return true;
})();`;
}
