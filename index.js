import express from "express";
import fs from "fs";
import { z } from "zod";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

// --------------------
// App setup
// --------------------
const app = express();
app.use(express.json());

console.log("Jarvis online");

const requiredEnv = [
  "OPENAI_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}
// --------------------
// OpenAI client
// --------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------------------
// GitHub App Octokit
// --------------------
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});

// --------------------
// Schema
// --------------------
const IntentSchema = z.object({
  intent: z.string().min(5),
});

// --------------------
// Helper: plan from intent
// --------------------
async function planFromIntent(intent) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "You are Jarvis Maintainer. Output STRICT JSON with keys: goal, affected_repos, scope, risk.",
      },
      { role: "user", content: intent },
    ],
    temperature: 0.2,
  });

  return JSON.parse(completion.choices[0].message.content);
}

// --------------------
// POST /intent
// --------------------
app.post("/intent", async (req, res) => {
  try {
    const { intent } = IntentSchema.parse(req.body);

    const plan = await planFromIntent(intent);
    console.log("MODEL OUTPUT:", plan);

    const id = Date.now();
    const path = `requests/REQUEST-${id}.md`;

    const body = `
# REQUEST-${id}

## Goal
${plan.goal}

## Affected Repos
${plan.affected_repos.join(", ")}

## Scope
${plan.scope}

## Risk
${plan.risk}
`.trim();

    await octokit.request(
      "PUT /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "vesper-systems",
        repo: "vesper-maintainer",
        path,
        message: `REQUEST-${id}: ${plan.goal}`,
        content: Buffer.from(body).toString("base64"),
      }
    );

    res.json({ ok: true, request: path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jarvis listening on ${PORT}`);
});