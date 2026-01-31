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
// GitHub App key (LOCAL FILE or ENV VAR)
// --------------------
let privateKey;

if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
  privateKey = fs.readFileSync(
    process.env.GITHUB_APP_PRIVATE_KEY_PATH,
    "utf8"
  );
} else {
  privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
}

// --------------------
// GitHub App Octokit
// --------------------
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID,
    privateKey,
  },
});

// --------------------
// Schema
// --------------------
const IntentSchema = z.object({
  intent: z.string().min(5),
});

// --------------------
// Root + health
// --------------------
app.get("/", (req, res) => {
  res.json({ ok: true, service: "jarvis-cloud" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// --------------------
// Web UI
// --------------------
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jarvis — Modern UI</title>
  <style>
    :root{
      --bg:#0f1720;
      --card: rgba(255,255,255,0.04);
      --muted: #9aa4b2;
      --accent: linear-gradient(90deg,#7c3aed,#06b6d4);
      --glass: rgba(255,255,255,0.02);
      --radius:12px;
      --maxw:1100px;
      --gap:18px;
    }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;background:var(--bg);color:#e6eef6;font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    .wrap{max-width:var(--maxw);margin:32px auto;padding:24px;border-radius:16px;background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);box-shadow:0 6px 30px rgba(2,6,23,0.6)}
    header{display:flex;align-items:center;gap:18px;margin-bottom:18px}
    .logo{width:48px;height:48px;border-radius:10px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff}
    h1{font-size:20px;margin:0}
    .sub{color:var(--muted);font-size:13px}

    /* Tabs */
    .tabs{display:flex;gap:8px;margin-top:18px}
    .tab{background:var(--glass);Padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.03);cursor:pointer;color:var(--muted)}
    .tab.active{background:linear-gradient(90deg,#111827, rgba(255,255,255,0.02));color:#fff;box-shadow:0 6px 18px rgba(2,6,23,0.6)}

    .body{display:grid;grid-template-columns: 1fr 340px;gap:var(--gap);margin-top:20px}
    @media (max-width:900px){.body{grid-template-columns:1fr}}

    .panel{background:var(--card);padding:18px;border-radius:var(--radius);min-height:180px}

    /* Composer */
    label{display:block;color:var(--muted);font-size:13px;margin-bottom:6px}
    textarea#intent{width:100%;min-height:140px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.03);background:transparent;color:inherit;resize:vertical}
    .row{display:flex;gap:10px;align-items:center}
    button.primary{background:var(--accent);border:none;padding:10px 14px;border-radius:10px;color:white;cursor:pointer}
    button.ghost{background:transparent;border:1px solid rgba(255,255,255,0.04);color:var(--muted);padding:8px 12px;border-radius:8px;cursor:pointer}

    /* Output card */
    .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.03)}
    .card h3{margin:0 0 8px 0}
    .meta{color:var(--muted);font-size:13px}
    .section{margin-top:12px}
    .copy{float:right;background:transparent;border:none;color:var(--muted);cursor:pointer}

    /* Right column list */
    .list-item{padding:12px;border-radius:10px;background:rgba(255,255,255,0.01);border:1px solid rgba(255,255,255,0.02);margin-bottom:10px}
    .small{font-size:13px;color:var(--muted)}

  </style>
</head>
<body>
  <div class="wrap" role="application">
    <header>
      <div class="logo">J</div>
      <div>
        <h1>Jarvis</h1>
        <div class="sub">Intent-driven request authoring • GitHub integration</div>
      </div>
    </header>

    <div class="tabs" role="tablist" aria-label="Main tabs">
      <button class="tab active" data-tab="composer" onclick="showTab('composer')">Composer</button>
      <button class="tab" data-tab="requests" onclick="showTab('requests')">Requests</button>
      <button class="tab" data-tab="settings" onclick="showTab('settings')">Settings</button>
    </div>

    <div class="body">
      <main>
        <section id="composer" class="panel" role="tabpanel">
          <label for="intent">Describe what you want Jarvis to do</label>
          <textarea id="intent" placeholder="E.g. Create a tiny feature that adds a status badge to the README..." aria-label="Intent input"></textarea>

          <div style="display:flex;gap:10px;margin-top:12px;align-items:center">
            <button id="sendBtn" class="primary" onclick="sendIntent()">Send Intent</button>
            <button class="ghost" onclick="clearIntent()">Clear</button>
            <div class="small" id="status" aria-live="polite"></div>
          </div>

          <div id="outputArea" style="margin-top:16px"></div>
        </section>

        <section id="requests" class="panel" role="tabpanel" hidden>
          <h3>Requests</h3>
          <div class="small">No remote request index available yet. This panel will list created requests and receipts for quick access.</div>
        </section>

        <section id="settings" class="panel" role="tabpanel" hidden>
          <h3>Settings</h3>
          <div class="small">Environment: server-side configuration required. Add integrations here later.</div>
        </section>
      </main>

      <aside>
        <div class="panel">
          <h4 style="margin:0 0 8px 0">Recent</h4>
          <div id="recentList">
            <div class="list-item">No items yet — create a request from Composer</div>
          </div>
        </div>

        <div class="panel" style="margin-top:var(--gap)">
          <h4 style="margin:0 0 8px 0">Quick Actions</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="ghost" onclick="document.getElementById('intent').focus()">Focus Composer</button>
            <button class="ghost" onclick="copyLatest()">Copy Latest Request</button>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <script>
    function showTab(name){
      document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
      ['composer','requests','settings'].forEach(id=>{
        const el=document.getElementById(id);
        if(!el) return;
        el.hidden = (id!==name);
      });
    }

    function clearIntent(){ document.getElementById('intent').value=''; document.getElementById('outputArea').innerHTML=''; }

    async function sendIntent(){
      const btn = document.getElementById('sendBtn');
      const status = document.getElementById('status');
      const intent = document.getElementById('intent').value.trim();
      if(!intent){ status.textContent='Please describe an intent.'; return }
      btn.disabled = true; btn.textContent = 'Working...'; status.textContent = '';

      try{
        const res = await fetch('/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent})});
        const data = await res.json();
        renderResponse(data);
        status.textContent = data.ok ? 'Request created' : 'Error';
        // add to recent
        addRecent(data.request_path || data.request_markdown || 'request');
      }catch(err){
        status.textContent = 'Network error';
        console.error(err);
      }finally{
        btn.disabled=false; btn.textContent='Send Intent';
      }
    }

    function renderResponse(data){
      const area = document.getElementById('outputArea');
      area.innerHTML = '';
      const md = data.request_markdown || '';
      const wrapper = document.createElement('div'); wrapper.className='card';
      const header = document.createElement('div');
        const h = document.createElement('h3'); h.style.display = 'inline-block'; h.textContent = 'Request';
        const copyBtn = document.createElement('button'); copyBtn.className = 'copy'; copyBtn.title = 'Copy markdown'; copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => { navigator.clipboard.writeText(md || ''); };
        header.appendChild(h); header.appendChild(copyBtn);
      wrapper.appendChild(header);

      // naive markdown split into sections
      const parts = md.split('\n## ').map(s=>s.trim()).filter(Boolean);
      parts.forEach(p=>{
        const idx = p.indexOf('\n');
        const title = idx>0 ? p.slice(0,idx).replace(/^#*\s*/,'') : p;
        const content = idx>0 ? p.slice(idx+1).trim() : '';
        const s = document.createElement('div'); s.className='section';
            s.innerHTML = '<strong>' + escapeHtml(title) + '</strong><div class="small">' + escapeHtml(content).replace(/\n/g,'<br/>') + '</div>';
        wrapper.appendChild(s);
      });

      area.appendChild(wrapper);
    }

    function addRecent(text){
      const list = document.getElementById('recentList');
      const el = document.createElement('div'); el.className='list-item'; el.textContent = text;
      list.prepend(el);
      // keep max 8
      while(list.children.length>8) list.removeChild(list.lastChild);
    }

    function copyLatest(){
      const first = document.querySelector('#recentList .list-item');
      if(first) navigator.clipboard.writeText(first.textContent || '');
    }

    function escapeHtml(str){ if(!str) return ''; return str.replace(/[&<>\\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function escapeForInline(s){ return ''; }
  </script>
</body>
</html>
  `);
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

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: "vesper-systems",
      repo: "vesper-maintainer",
      path,
      message: `REQUEST-${id}: ${plan.goal}`,
      content: Buffer.from(body).toString("base64"),
    });

    res.json({
      ok: true,
      request_path: path,
      request_markdown: body,
    });
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
