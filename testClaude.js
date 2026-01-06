const models = [
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
  "claude-2.1",
  "claude-2.0",
  "claude-instant-1.2"
];

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ERROR: ANTHROPIC_API_KEY not found in environment variables.");
  process.exit(1);
}

console.log("Testing Claude API key with various models...\n");

(async () => {
  for (const model of models) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 50,
          messages: [{ role: "user", content: "Hello Claude!" }]
        })
      });
      const data = await res.json();
      if (data.content && data.content[0] && data.content[0].text) {
        console.log(`✅ Model "${model}" works! Response: ${data.content[0].text.substring(0, 50)}`);
      } else if (data.error) {
        console.log(`❌ Model "${model}" - Error: ${data.error.message}`);
      } else {
        console.log(`❌ Model "${model}" - Unexpected response:`, JSON.stringify(data).substring(0, 100));
      }
    } catch (err) {
      console.log(`❌ Model "${model}" - Fetch error: ${err.message}`);
    }
  }
})();
