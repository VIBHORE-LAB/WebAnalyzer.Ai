// inject.js
(function () {
  if (window.__webAnalyzerInjected) {
    console.log("inject.js already injected, skipping");
    return;
  }
  window.__webAnalyzerInjected = true;

  console.log("inject.js loaded on:", window.location.href, "at:", new Date().toISOString());

  // Capture fetch calls
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url, method;
    try {
      url = args[0] instanceof Request ? args[0].url : args[0];
      method = (args[1] && args[1].method) || (args[0] instanceof Request ? args[0].method : "GET");
      console.log("Captured fetch:", { url, method, timestamp: new Date().toISOString() });
      window.postMessage(
        {
          type: "__webanalyzer__API_CALL_CAPTURE",
          method,
          url,
          timestamp: Date.now(),
        },
        window.location.origin
      );
    } catch (error) {
      console.error("Error capturing fetch:", error);
    }
    return originalFetch.apply(this, args);
  };

  // Capture XMLHttpRequest calls
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      console.log("Captured XMLHttpRequest:", { method, url, timestamp: new Date().toISOString() });
      window.postMessage(
        {
          type: "__webanalyzer__API_CALL_CAPTURE",
          method,
          url,
          timestamp: Date.now(),
        },
        window.location.origin
      );
    } catch (error) {
      console.error("Error capturing XMLHttpRequest:", error);
    }
    return open.apply(this, [method, url, ...rest]);
  };

  // Capture axios calls
  if (window.axios) {
    const originalAxios = window.axios;
    window.axios = function (...args) {
      try {
        const config = args[0];
        const url = config.url || (typeof args[0] === "string" ? args[0] : "");
        const method = (config.method || "GET").toUpperCase();
        console.log("Captured axios:", { method, url, timestamp: new Date().toISOString() });
        window.postMessage(
          {
            type: "__webanalyzer__API_CALL_CAPTURE",
            method,
            url,
            timestamp: Date.now(),
          },
          window.location.origin
        );
      } catch (error) {
        console.error("Error capturing axios:", error);
      }
      return originalAxios.apply(this, args);
    };
  }

  // Capture React hooks
  function captureReactHooks() {
    try {
      if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log("React DevTools not detected");
        return;
      }
      const reactInstance = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.get(1);
      if (!reactInstance) {
        console.log("No React instance found");
        return;
      }
      const roots = reactInstance.getFiberRoots(1);
      const hooksData = [];

      for (const root of roots) {
        let current = root.current;
        if (!current) continue;

        function traverseFiber(fiber) {
          if (!fiber) return;
          if (fiber.memoizedState) {
            let hook = fiber.memoizedState;
            let hookIndex = 0;
            while (hook) {
              if (hook.memoizedState) {
                const hookType = inferHookType(hook);
                const hookInfo = {
                  component: fiber.type?.name || "Unknown",
                  hookIndex,
                  hookType,
                  state: JSON.stringify(hook.memoizedState, null, 2),
                  dependencies: hook.queue ? JSON.stringify(hook.queue.pending, null, 2) : null,
                };
                hooksData.push(hookInfo);
                console.log("Captured hook:", hookInfo);
                window.postMessage(
                  {
                    type: "__webanalyzer__HOOK_CAPTURE",
                    hook: hookInfo,
                    timestamp: Date.now(),
                  },
                  window.location.origin
                );
              }
              hook = hook.next;
              hookIndex++;
            }
          }
          // Traverse children
          if (fiber.child) traverseFiber(fiber.child);
          if (fiber.sibling) traverseFiber(fiber.sibling);
        }

        traverseFiber(current);
      }
    } catch (error) {
      console.error("Error capturing React hooks:", error);
    }
  }

  function inferHookType(hook) {
    if (hook.memoizedState && hook.queue) return "useState";
    if (hook.memoizedState === null && hook.next) return "useEffect";
    // Add more hook type inferences as needed (e.g., useQuery)
    return "Unknown";
  }

  // Run hook capture periodically
  setInterval(captureReactHooks, 2000);

  // Debounce postMessage
  let pendingMessages = [];
  let debounceTimeout;
  const originalPostMessage = window.postMessage;
  window.postMessage = function (message, targetOrigin, transfer) {
    if (message.type === "__webanalyzer__API_CALL_CAPTURE" || message.type === "__webanalyzer__HOOK_CAPTURE") {
      pendingMessages.push({ message, targetOrigin, transfer });
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        pendingMessages.forEach(({ message, targetOrigin, transfer }) => {
          originalPostMessage.call(window, message, targetOrigin, transfer);
        });
        pendingMessages = [];
      }, 50);
    } else {
      originalPostMessage.call(window, message, targetOrigin, transfer);
    }
  };
})();