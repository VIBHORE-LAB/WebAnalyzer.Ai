window.CohereAnalyze = async function (prompt, apiKey) {
  try {
    const response = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-r-plus",
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const json = await response.json();

    return (
      (json.generations && json.generations[0] && json.generations[0].text) ||
      "No response from Cohere."
    );
  } catch (err) {
    console.error("Cohere API error:", err);
    return "Error analyzing with Cohere.";
  }
};
