importScripts("config.js");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    console.log("Injecting inject.js on tab load:", tab.url);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["inject.js"],
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to inject inject.js:", chrome.runtime.lastError.message);
      } else {
        console.log("inject.js injected successfully");
        chrome.storage.local.set({ [`apiCalls_${tabId}`]: [], [`hooks_${tabId}`]: [] }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to clear data:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.url && (details.url.startsWith("http://") || details.url.startsWith("https://"))) {
    console.log("Injecting inject.js before navigation:", details.url);
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["inject.js"],
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to inject inject.js on navigation:", chrome.runtime.lastError.message);
      } else {
        console.log("inject.js injected successfully on navigation");
        chrome.storage.local.set({ [`apiCalls_${details.tabId}`]: [], [`hooks_${details.tabId}`]: [] }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to clear data:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SEND_TO_COHERE") {
    const prompt = message.prompt;
    console.log("Received SEND_TO_COHERE message with prompt:", prompt);
    (async () => {
      try {
        const response = await fetch("https://api.cohere.ai/v1/chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "command-r-plus",
            message: prompt,
            temperature: 0.3,
            max_tokens: 500,
          }),
        });
        const json = await response.json();
        const result = json.text || json.generations?.[0]?.text || "No response";
        console.log("Cohere API response:", result);
        sendResponse({ result });
      } catch (error) {
        console.error("Error sending to Cohere:", error);
        sendResponse({ error: "Failed to send to Cohere: " + error.message });
      }
    })();
    return true;
  } else if (message.type === "GET_TAB_ID") {
    if (sender.tab?.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      console.error("No tab ID available for GET_TAB_ID");
      sendResponse({ error: "No tab ID available." });
    }
    return true;
  } else if (message.type === "REINJECT_SCRIPT") {
    if (sender.tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ["inject.js"],
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to reinject inject.js:", chrome.runtime.lastError.message);
        } else {
          console.log("inject.js reinjected successfully");
        }
      });
    }
    return true;
  }
});