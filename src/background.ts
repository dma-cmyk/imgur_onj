// background.ts

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'openSidePanel') {
    if (message.tabId) {
      // @ts-ignore - sidePanel might not be in the types if they are old, but we installed @types/chrome
      chrome.sidePanel.open({ tabId: message.tabId });
    } else {
      console.error('No tabId received to open side panel.');
    }
  } else if (message.action === 'historyUpdated') {
    // Notify all open history.html tabs to refresh
    chrome.tabs.query({ url: chrome.runtime.getURL('history.html') }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshHistory' });
        }
      });
    });
  }
});
