// prompt.js
window.displayPrompt = `
<div class="analysis-container">
  <div class="section">
    <span class="section-header">Page Title</span>
    <div class="list-item">{{title}}</div>
  </div>
  <div class="section">
    <span class="section-header"> URL</span>
    <div class="list-item">{{url}}</div>
  </div>
  <div class="section">
    <span class="section-header"> Meta Tags</span>
    {{metaTags}}
  </div>
  <div class="section">
    <span class="section-header">Scripts Used</span>
    {{scripts}}
  </div>
  <div class="section">
    <span class="section-header">Stylesheets</span>
    {{stylesheets}}
  </div>
  <details>
    <summary class="section-header">Captured API Calls</summary>
    {{apiCalls}}
  </details>
  <details>
    <summary class="section-header">Captured React Hooks</summary>
    {{hooks}}
  </details>
  <hr class="separator" />
</div>
`;

window.buildPrompt = function (data) {
  const metaTags =
    (data.metaTags || [])
      .map(
        (m) =>
          `<div class="list-item">${m.name || m.property}: ${m.content}</div>`
      )
      .join("\n") || '<div class="list-item">None</div>';
  const scripts =
    (data.scripts || [])
      .map((s) => `<div class="list-item">${s.src || "Inline script"}</div>`)
      .join("\n") || '<div class="list-item">None</div>';
  const stylesheets =
    (data.stylesheets || [])
      .map((s) => `<div class="list-item">${s}</div>`)
      .join("\n") || '<div class="list-item">None</div>';
  const apiCalls =
    (data.apiCalls || [])
      .map((api) => `<div class="list-item">${api.method} ${api.url}</div>`)
      .join("\n") || '<div class="list-item">None</div>';
  const hooks =
    (data.hooks || [])
      .map(
        (hook) =>
          `<div class="list-item">${hook.hookType} in ${hook.component} (State: ${hook.state})</div>`
      )
      .join("\n") || '<div class="list-item">None</div>';

  const analysisPrompt = `
Analyze the following webpage data and describe the technology stack, frameworks, and purpose of the captured API calls and React hooks. For hooks, identify which ones are likely responsible for rendering specific data (e.g., a user's name) and trace their data sources (e.g., API calls or state).

**Page Data:**
- **Title**: ${data.title}
- **URL**: ${data.url}
- **HTML Length**: ${data.htmlLength} characters
- **Meta Tags**: ${JSON.stringify(data.metaTags, null, 2)}
- **Scripts**: ${JSON.stringify(data.scripts, null, 2)}
- **Stylesheets**: ${JSON.stringify(data.stylesheets, null, 2)}
- **API Calls**: ${JSON.stringify(data.apiCalls, null, 2)}
- **React Hooks**: ${JSON.stringify(data.hooks, null, 2)}

**Instructions:**
- Identify the frontend and backend frameworks (e.g., React, Node.js).
- Describe the purpose of each API call (e.g., fetching user data).
- If you can not find nay api call read the data on the page and give api calls that you think are used to fetch the data.
- For each React hook, infer its purpose (e.g., useState for user name, useEffect for fetching data) and identify which hooks render specific data (e.g., a user's name) by correlating with API calls or state.
- Format the response with clear sections using Markdown-like headers (e.g., **Frontend/Backend Frameworks**, **APIs and Their Purpose**, **React Hooks Analysis**).
`;

  window.displayPrompt = window.displayPrompt
    .replace("{{title}}", data.title)
    .replace("{{url}}", data.url)
    .replace("{{metaTags}}", metaTags)
    .replace("{{scripts}}", scripts)
    .replace("{{stylesheets}}", stylesheets)
    .replace("{{apiCalls}}", apiCalls)
    .replace("{{hooks}}", hooks);

  return analysisPrompt;
};
