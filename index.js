import express from "express";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

const app = express();
app.use(express.json());

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const IntentSchema = z.object({
  intent: z.string().min(5),
});

app.post("/intent", async (req, res) => {
  const parsed = IntentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid intent" });
  }

  const { intent } = parsed.data;
  const id = Date.now();

  const content = `
# REQUEST-${id}

## Goal
${intent}

## Affected Repos
- TBD

## Scope
TBD

## Definition of Done
- CI passes

## Approval
Status: PENDING
`;

  await octokit.repos.createOrUpdateFileContents({
    owner: "vesper-systems",
    repo: "vesper-maintainer",
    path: `requests/REQUEST-${id}.md`,
    message: "jarvis: create request",
    content: Buffer.from(content).toString("base64"),
  });

  res.json({ ok: true, request: `REQUEST-${id}` });
});

app.listen(3000, () => console.log("Jarvis online"));
