/**
 * Background Service Worker for Vegan Advocacy Companion
 * Handles extension icon click to open side panel
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

console.log('Vegan Advocacy Companion service worker loaded');
