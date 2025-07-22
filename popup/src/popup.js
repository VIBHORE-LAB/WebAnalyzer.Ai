// popup/src/popup.js
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", () => {
    const output = document.getElementById("output");
    output.innerText = "Analyzing...";
    output.classList.add("loading");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const tabId = tab.id;
      const url = tab.url;

      console.log("Analyzing tab:", { tabId, url });

      if (!url || !(url.startsWith("http://") || url.startsWith("https://"))) {
        output.classList.remove("loading");
        output.classList.add("error");
        output.innerText =
          "Error: Cannot analyze this page (restricted URL, e.g., chrome:// or file://).";
        return;
      }

      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000;

      const sendAnalyzePageMessage = () => {
        const timeout = setTimeout(() => {
          if (retryCount < maxRetries - 1) {
            retryCount++;
            console.warn(`Retrying ANALYZE_PAGE (${retryCount}/${maxRetries})`);
            sendAnalyzePageMessage();
          } else {
            output.classList.remove("loading");
            output.classList.add("error");
            output.innerText =
              "Error: Content script did not respond after retries.";
            console.error("ANALYZE_PAGE failed after retries");
          }
        }, 5000);

        chrome.tabs.sendMessage(
          tabId,
          { type: "ANALYZE_PAGE" },
          async (pageData) => {
            clearTimeout(timeout);
            console.log("ANALYZE_PAGE response:", pageData);
            if (chrome.runtime.lastError) {
              if (retryCount < maxRetries - 1) {
                retryCount++;
                console.warn(
                  `Retrying ANALYZE_PAGE (${retryCount}/${maxRetries}) due to error:`,
                  chrome.runtime.lastError.message
                );
                setTimeout(sendAnalyzePageMessage, retryDelay);
                return;
              }
              output.classList.remove("loading");
              output.classList.add("error");
              output.innerText =
                "Error: Could not communicate with content script: " +
                chrome.runtime.lastError.message;
              console.error("Runtime error:", chrome.runtime.lastError);
              return;
            }
            if (!pageData) {
              output.classList.remove("loading");
              output.classList.add("error");
              output.innerText = "Error: Could not retrieve page data.";
              console.error("No pageData received");
              return;
            }
            if (pageData.error) {
              output.classList.remove("loading");
              output.classList.add("error");
              output.innerText = "Failed to extract data: " + pageData.error;
              return;
            }
            console.log("Captured API calls:", pageData.apiCalls);
            const prompt = buildPrompt(pageData);
            chrome.runtime.sendMessage(
              { type: "SEND_TO_COHERE", prompt },
              (response) => {
                console.log("SEND_TO_COHERE response:", response);
                output.classList.remove("loading");
                if (response.error) {
                  output.classList.add("error");
                  output.innerText = "Failed to analyze: " + response.error;
                  return;
                }
                const formattedResponse = response.result
                  .replace(
                    /\*\*(.*?)\*\*/g,
                    '<span class="section-header">$1</span>'
                  )
                  .replace(
                    /^- (.*?):$/gm,
                    '<span class="section-header">$1:</span>'
                  )
                  .replace(
                    /^\s*-\s*(.*)$/gm,
                    '<div class="list-item">$1</div>'
                  );
                output.innerHTML = window.displayPrompt + formattedResponse;
              }
            );
          }
        );
      };

      sendAnalyzePageMessage();
    });
  });
});
