// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    if (message.tabId) {
      chrome.sidePanel.open({ tabId: message.tabId });
    } else {
      console.error('No tabId received to open side panel.');
    }
  } else if (message.action === 'historyUpdated') {
    // Notify all open history.html tabs to refresh
    chrome.tabs.query({ url: chrome.runtime.getURL('history.html') }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'refreshHistory' });
      });
    });
  }
});