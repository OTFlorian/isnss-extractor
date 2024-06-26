chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("http://isnss/main.aspx?cls=SVInfo")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }, () => {
      chrome.tabs.sendMessage(tab.id, { action: "extractInfo" }, (response) => {
        if (response && response.success) {
          console.log("Text copied to clipboard:", response.text);
        } else {
          console.error("Error copying text:", response ? response.error : "No response from content script");
        }
      });
    });
  }
});