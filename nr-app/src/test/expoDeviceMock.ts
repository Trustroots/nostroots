let isDevice = true;

export function setIsDeviceMock(value: boolean) {
  isDevice = value;
}

export function resetExpoDeviceMock() {
  isDevice = true;
}

export function createExpoDeviceMock() {
  return {
    get isDevice() {
      return isDevice;
    },
  };
}
