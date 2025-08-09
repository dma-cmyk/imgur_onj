// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    if (message.tabId) {
      chrome.sidePanel.open({ tabId: message.tabId });
    } else {
      console.error('No tabId received to open side panel.');
    }
  }
});