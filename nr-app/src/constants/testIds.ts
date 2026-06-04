export const TEST_IDS = {
  backupConfirm: {
    confirmButton: "backup-confirm-button",
    copySecretButton: "backup-copy-secret-button",
    finishButton: "backup-finish-button",
    input: "backup-confirm-input",
    secretText: "backup-secret-text",
    screen: "screen-backup-confirm",
  },
  identity: {
    continueButton: "identity-continue-button",
    skipButton: "identity-skip-button",
  },
  key: {
    continueButton: "key-continue-button",
    existingTab: "key-existing-tab",
    generateTab: "key-generate-tab",
    saveButton: "key-save-button",
    secretInput: "key-secret-input",
  },
  link: {
    confirmButton: "link-confirm-button",
    copyPublicKeyButton: "link-copy-public-key-button",
    openTrustrootsButton: "link-open-trustroots-button",
  },
  map: {
    addNoteContentInput: "add-note-content-input",
    addNoteSubmitButton: "add-note-submit-button",
    layerTrigger: "map-layer-trigger",
    navConnect: "nav-connect",
    navList: "nav-list",
    navMap: "nav-map",
    navSettings: "nav-settings",
    screen: "screen-map",
  },
  settings: {
    importKeyButton: "settings-import-key-button",
    root: "screen-settings",
  },
  trustroots: {
    codeInput: "trustroots-code-input",
    differentUsernameButton: "trustroots-different-username-button",
    legacyKeyButton: "trustroots-legacy-key-button",
    requestCodeButton: "trustroots-request-code-button",
    screen: "screen-onboarding-trustroots",
    submitCodeButton: "trustroots-submit-code-button",
    usernameInput: "trustroots-username-input",
  },
  welcome: {
    getStartedButton: "welcome-get-started-button",
    screen: "screen-welcome",
  },
} as const;
