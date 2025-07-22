// content.js
console.log("Content script loaded on:", window.location.href, "at:", new Date().toISOString());

const capturedApiCalls = new Map();
const capturedHooks = new Map();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  console.log("Received postMessage:", event.data, "origin:", event.origin);
  const { type, url, method, hook } = event.data || {};
  if (type === "__webanalyzer__API_CALL_CAPTURE" && url) {
    const key = `${method}:${url}`;
    if (!capturedApiCalls.has(key)) {
      capturedApiCalls.set(key, { url, method, timestamp: new Date().toISOString() });
      chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.tabId) {
          console.error("Failed to get tab ID for API call:", chrome.runtime.lastError?.message);
          return;
        }
        const tabId = response.tabId;
        chrome.storage.local.get([`apiCalls_${tabId}`], (result) => {
          const storedCalls = result[`apiCalls_${tabId}`] || [];
          storedCalls.push({ url, method, timestamp: new Date().toISOString() });
          chrome.storage.local.set({ [`apiCalls_${tabId}`]: storedCalls }, () => {
            if (chrome.runtime.lastError) {
              console.error("Failed to store API calls:", chrome.runtime.lastError.message);
            } else {
              console.log("Stored API call:", { url, method, tabId });
            }
          });
        });
      });
    }
  } else if (type === "__webanalyzer__HOOK_CAPTURE" && hook) {
    const key = `${hook.component}:${hook.hookIndex}`;
    if (!capturedHooks.has(key)) {
      capturedHooks.set(key, hook);
      chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.tabId) {
          console.error("Failed to get tab ID for hook:", chrome.runtime.lastError?.message);
          return;
        }
        const tabId = response.tabId;
        chrome.storage.local.get([`hooks_${tabId}`], (result) => {
          const storedHooks = result[`hooks_${tabId}`] || [];
          storedHooks.push(hook);
          chrome.storage.local.set({ [`hooks_${tabId}`]: storedHooks }, () => {
            if (chrome.runtime.lastError) {
              console.error("Failed to store hooks:", chrome.runtime.lastError.message);
            } else {
              console.log("Stored hook:", hook);
            }
          });
        });
      });
    }
  }
});

// Monitor DOM changes for SPA navigations
const observer = new MutationObserver((mutations) => {
  console.log("DOM changed, reinjecting inject.js");
  chrome.runtime.sendMessage({ type: "REINJECT_SCRIPT" });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_PAGE") {
    console.log("Received ANALYZE_PAGE message on:", window.location.href);
    if (!window.location.href.startsWith("http")) {
      console.log("Restricted URL detected:", window.location.href);
      sendResponse({ error: "Cannot analyze this page (restricted URL)." });
      return true;
    }
    try {
      const html = document.documentElement.outerHTML || "";
      const title = document.title || "Untitled";
      const url = location.href || "";
      const metaTags = Array.from(document.querySelectorAll("meta")).map((m) => ({
        name: m.getAttribute("name") || "",
        content: m.getAttribute("content") || "",
        property: m.getAttribute("property") || "",
      }));
      const scripts = Array.from(document.scripts)
        .map((s) => ({
          src: s.src || null,
          inline: s.src ? null : s.innerText.slice(0, 200),
        }))
        .filter((s) => s.src && !s.src.startsWith("chrome-extension://"));
      const stylesheets = Array.from(
        document.querySelectorAll("link[rel='stylesheet']")
      )
        .map((l) => l.href || "")
        .filter((href) => !href.startsWith("chrome-extension://"));

      const tabId = sender.tab?.id;
      if (tabId) {
        chrome.storage.local.get([`apiCalls_${tabId}`, `hooks_${tabId}`], (result) => {
          if (chrome.runtime.lastError) {
            console.error("Failed to retrieve data:", chrome.runtime.lastError.message);
            sendResponse({ error: "Failed to retrieve stored data." });
            return;
          }
          const apiCalls = result[`apiCalls_${tabId}`] || [];
          const hooks = result[`hooks_${tabId}`] || [];
          console.log("Sending page data:", { title, url, htmlLength: html.length, apiCalls, hooks });
          sendResponse({
            title,
            url,
            htmlLength: html.length,
            metaTags,
            scripts,
            stylesheets,
            apiCalls,
            hooks,
          });
        });
      } else {
        console.warn("sender.tab.id unavailable, falling back to GET_TAB_ID");
        chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
          if (chrome.runtime.lastError || !response || !response.tabId) {
            console.error("Failed to get tab ID:", chrome.runtime.lastError?.message || "No response");
            sendResponse({ error: "Failed to retrieve tab ID." });
            return;
          }
          const tabId = response.tabId;
          chrome.storage.local.get([`apiCalls_${tabId}`, `hooks_${tabId}`], (result) => {
            if (chrome.runtime.lastError) {
              console.error("Failed to retrieve data:", chrome.runtime.lastError.message);
              sendResponse({ error: "Failed to retrieve stored data." });
              return;
            }
            const apiCalls = result[`apiCalls_${tabId}`] || [];
            const hooks = result[`hooks_${tabId}`] || [];
            console.log("Sending page data:", { title, url, htmlLength: html.length, apiCalls, hooks });
            sendResponse({
              title,
              url,
              htmlLength: html.length,
              metaTags,
              scripts,
              stylesheets,
              apiCalls,
              hooks,
            });
          });
        });
      }
      return true;
    } catch (error) {
      console.error("Error in ANALYZE_PAGE handler:", error);
      sendResponse({ error: "Failed to extract page info: " + error.message });
      return true;
    }
  } else if (msg.type === "GET_TAB_ID") {
    if (sender.tab?.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      console.error("No tab ID available for GET_TAB_ID");
      sendResponse({ error: "No tab ID available." });
    }
    return true;
  } else if (msg.type === "REINJECT_SCRIPT") {
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