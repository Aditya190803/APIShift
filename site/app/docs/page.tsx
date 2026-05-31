"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   useReveal
   ───────────────────────────────────────────── */
function useReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

/* ─────────────────────────────────────────────
   CopyButton
   ───────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button className="copy-trigger" data-copied={copied} onClick={handleCopy}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

/* ─────────────────────────────────────────────
   CodeBlock
   ───────────────────────────────────────────── */
function CodeBlock({
  label,
  copy,
  children,
}: {
  label: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="code-block" style={{ padding: 0 }}>
      <div className="code-block-header">
        <span className="code-block-label">{label}</span>
        <CopyButton text={copy} />
      </div>
      <div style={{ padding: "1.25rem", fontFamily: "var(--font-mono)", fontSize: "0.82rem", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--gray-300)" }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sidebar nav items
   ───────────────────────────────────────────── */
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "python-quickstart", label: "Python Quick Start" },
  { id: "python-providers", label: "Providers" },
  { id: "python-streaming", label: "Streaming" },
  { id: "python-rag", label: "RAG & Memory" },
  { id: "python-context", label: "Context Packing" },
  { id: "python-exceptions", label: "Exceptions" },
  { id: "python-api", label: "Python API Reference" },
  { id: "ts-quickstart", label: "TypeScript Quick Start" },
  { id: "ts-orchestrator", label: "APIShift Class (TS)" },
  { id: "ts-streaming", label: "TS Streaming" },
  { id: "ts-memory", label: "TS Memory" },
  { id: "ts-api", label: "TypeScript API Reference" },
  { id: "architecture", label: "Architecture" },
  { id: "faq", label: "FAQ" },
];

/* ─────────────────────────────────────────────
   Docs Page
   ───────────────────────────────────────────── */
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const r1 = useReveal();
  const r2 = useReveal();
  const r3 = useReveal();
  const r4 = useReveal();
  const r5 = useReveal();
  const r6 = useReveal();
  const r7 = useReveal();
  const r8 = useReveal();
  const r9 = useReveal();
  const r10 = useReveal();
  const r11 = useReveal();
  const r12 = useReveal();
  const r13 = useReveal();
  const r14 = useReveal();
  const r15 = useReveal();
  const refs = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15];

  return (
    <>
      {/* NAV */}
      <nav className={`nav ${navScrolled ? "nav--scrolled" : ""}`}>
        <div className="nav-inner">
          <a href="/" className="nav-logo">
            <em>API</em>SHIFT
          </a>
          <div className="nav-links">
            <a href="/" className="nav-link">home</a>
            <a href="/docs" className="nav-link" style={{ color: "var(--green)" }}>docs</a>
            <a
              href="https://github.com/Aditya190803/APIShift"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
            >
              github
            </a>
          </div>
        </div>
      </nav>

      <div style={{ display: "flex", paddingTop: 56, minHeight: "100vh" }}>
        {/* SIDEBAR */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            position: "sticky",
            top: 56,
            height: "calc(100vh - 56px)",
            overflowY: "auto",
            borderRight: "1px solid var(--border)",
            padding: "2rem 0",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                display: "block",
                padding: "0.45rem 1.5rem",
                fontSize: "0.78rem",
                fontFamily: "var(--font-mono)",
                color: activeSection === s.id ? "var(--green)" : "var(--gray-500)",
                borderLeft: activeSection === s.id ? "2px solid var(--green)" : "2px solid transparent",
                transition: "all 0.15s ease",
                textDecoration: "none",
              }}
            >
              {s.label}
            </a>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, minWidth: 0, padding: "3rem 4rem", display: "flex", flexDirection: "column", gap: "4rem" }}>

          {/* ═══ OVERVIEW ═══ */}
          <section id="overview" ref={refs[0]} className="reveal">
            <span className="label" style={{ display: "block", marginBottom: "0.5rem" }}>Documentation</span>
            <h1 className="heading-lg" style={{ marginBottom: "1rem" }}>APIShift Docs</h1>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Same-provider API key pooling for LLM apps with adaptive key rotation,
              cooldown-aware retries, and optional cross-provider fallback. Available for <strong style={{ color: "var(--white)" }}>Python</strong> and <strong style={{ color: "var(--white)" }}>TypeScript/Node.js</strong>.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)", border: "1px solid var(--border)" }}>
              <div style={{ background: "var(--black)", padding: "1.25rem" }}>
                <div className="label" style={{ marginBottom: "0.5rem" }}>Python</div>
                <code className="mono" style={{ fontSize: "0.85rem", color: "var(--white)" }}>pip install APIShift</code>
              </div>
              <div style={{ background: "var(--black)", padding: "1.25rem" }}>
                <div className="label" style={{ marginBottom: "0.5rem" }}>TypeScript</div>
                <code className="mono" style={{ fontSize: "0.85rem", color: "var(--white)" }}>npm install @apishift/core</code>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--gray-300)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--green)" }}>Core concepts:</strong> APIShift treats multiple keys/accounts for the same provider as a pool.
                It rotates healthy keys, cools down only the limited key, and shifts providers only when the primary pool is unavailable. Context is preserved.
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ PYTHON QUICKSTART ═══ */}
          <section id="python-quickstart" ref={refs[1]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Python Quick Start</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Install from PyPI and set up a same-provider key pool in under 10 lines.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <CodeBlock label="terminal" copy="pip install APIShift">
                <span className="t-op">$</span> pip install APIShift
              </CodeBlock>

              <CodeBlock
                label="basic usage"
                copy={`from APIShift import Conversation

conversation = Conversation.from_gemini_key_pool(
    api_keys=['key_1', 'key_2', 'key_3'],
    key_strategy='adaptive',
    system_prompt="You are a helpful assistant.",
)

response = conversation.send_message("Explain quantum computing.")
print(response)`}
              >
                <span className="t-kw">from</span> <span className="t-fn">APIShift</span> <span className="t-kw">import</span> <span className="t-fn">Conversation</span>{"\n\n"}
                <span className="t-var">conversation</span> <span className="t-op">=</span> <span className="t-fn">Conversation</span>.<span className="t-fn">from_gemini_key_pool</span>({"\n"}
                {"    "}<span className="t-var">api_keys</span><span className="t-op">=</span>[<span className="t-str">&apos;key_1&apos;</span>, <span className="t-str">&apos;key_2&apos;</span>, <span className="t-str">&apos;key_3&apos;</span>],{"\n"}
                {"    "}<span className="t-var">key_strategy</span><span className="t-op">=</span><span className="t-str">&apos;adaptive&apos;</span>,{"\n"}
                {"    "}<span className="t-var">system_prompt</span><span className="t-op">=</span><span className="t-str">&quot;You are a helpful assistant.&quot;</span>,{"\n"}
                <span className="t-op">)</span>{"\n\n"}
                <span className="t-var">response</span> <span className="t-op">=</span> <span className="t-var">conversation</span>.<span className="t-fn">send_message</span>(<span className="t-str">&quot;Explain quantum computing.&quot;</span>){"\n"}
                <span className="t-fn">print</span>(response)
              </CodeBlock>

              <CodeBlock
                label="fallback providers shortcut"
                copy={`conversation = Conversation.from_free_providers(
    gemini_keys=['key_1', 'key_2'],
    openrouter_keys=['key_a'],
    discover_openrouter_models=True,
    groq_keys=['key_g'],
    memory_path='.apishift/memory.jsonl',
    max_context_tokens=6000,
)`}
              >
                <span className="t-cm"># Same provider first, fallback providers second</span>{"\n"}
                <span className="t-var">conversation</span> <span className="t-op">=</span> <span className="t-fn">Conversation</span>.<span className="t-fn">from_free_providers</span>({"\n"}
                {"    "}<span className="t-var">gemini_keys</span><span className="t-op">=</span>[<span className="t-str">&apos;key_1&apos;</span>, <span className="t-str">&apos;key_2&apos;</span>],{"\n"}
                {"    "}<span className="t-var">openrouter_keys</span><span className="t-op">=</span>[<span className="t-str">&apos;key_a&apos;</span>],{"\n"}
                {"    "}<span className="t-var">discover_openrouter_models</span><span className="t-op">=</span><span className="t-kw">True</span>,{"\n"}
                {"    "}<span className="t-var">groq_keys</span><span className="t-op">=</span>[<span className="t-str">&apos;key_g&apos;</span>],{"\n"}
                {"    "}<span className="t-var">memory_path</span><span className="t-op">=</span><span className="t-str">&apos;.apishift/memory.jsonl&apos;</span>,{"\n"}
                {"    "}<span className="t-var">max_context_tokens</span><span className="t-op">=</span><span className="t-num">6000</span>,{"\n"}
                )
              </CodeBlock>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ PROVIDERS ═══ */}
          <section id="python-providers" ref={refs[2]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Providers</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              All providers extend <code className="mono" style={{ color: "var(--green-dim)" }}>LLMProvider</code> and expose
              a normalized chat interface with per-key rotation and cooldown tracking.
            </p>

            {/* Provider table */}
            <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Provider</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Default Model</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Priority</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Free</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "GeminiProvider", model: "gemini-1.5-flash", priority: "10", free: "Yes" },
                    { name: "OpenRouterProvider", model: "llama-4-scout:free", priority: "20", free: "Yes" },
                    { name: "GroqProvider", model: "llama-4-scout", priority: "30", free: "Yes" },
                  ].map((p, i) => (
                    <tr key={p.name} style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--white)" }}>{p.name}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--gray-300)" }}>{p.model}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--gray-300)" }}>{p.priority}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--green)" }}>{p.free}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--gray-300)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--white)" }}>Key rotation:</strong> Each provider holds multiple API keys. When a key is rate-limited,
                it&apos;s cooled down for the duration specified by the <code className="mono" style={{ color: "var(--green-dim)" }}>Retry-After</code> header
                (or <code className="mono" style={{ color: "var(--green-dim)" }}>key_cooldown_seconds</code>, default 60s). The next healthy key is selected automatically.
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--gray-300)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--white)" }}>Provider sorting:</strong> Free-tier providers are always preferred. Within the same tier,
                lower <code className="mono" style={{ color: "var(--green-dim)" }}>priority</code> values are tried first.
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--gray-300)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--white)" }}>OpenRouter discovery:</strong> Set <code className="mono" style={{ color: "var(--green-dim)" }}>discover_openrouter_models=True</code> to
                query the OpenRouter API for all currently zero-priced models at runtime instead of using hardcoded defaults.
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ STREAMING ═══ */}
          <section id="python-streaming" ref={refs[3]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Streaming</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              <code className="mono" style={{ color: "var(--green-dim)" }}>send_message_stream</code> returns an iterator that yields string chunks.
              Failover happens before the first chunk is yielded (&quot;peeking&quot; strategy).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <CodeBlock
                label="streaming"
                copy={`for chunk in conversation.send_message_stream("Tell me a story."):
    print(chunk, end="", flush=True)`}
              >
                <span className="t-kw">for</span> chunk <span className="t-kw">in</span> conversation.<span className="t-fn">send_message_stream</span>(<span className="t-str">&quot;Tell me a story.&quot;</span>):{"\n"}
                {"    "}<span className="t-fn">print</span>(chunk, end=<span className="t-str">&quot;&quot;</span>, flush=<span className="t-kw">True</span>)
              </CodeBlock>

              <div style={{ padding: "1rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--gray-300)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--amber)" }}>How streaming failover works:</strong>{"\n\n"}
                1. APIShift initiates the stream with the current provider{"\n"}
                2. Attempts to retrieve the <em>first chunk</em> (the &quot;peek&quot;){"\n"}
                3. If the peek fails (429/quota), cools down the key,{"\n"}
                {"   "}tries another key in the same pool, then falls back if needed{"\n"}
                4. Once the first chunk succeeds, it&apos;s yielded to the caller{"\n"}
                5. If the stream breaks <em>after</em> yielding, the error{"\n"}
                {"   "}is raised — partial data has been consumed
              </div>

              <CodeBlock
                label="stream with error handling"
                copy={`try:
    for chunk in conversation.send_message_stream("Write a long essay."):
        print(chunk, end="")
except Exception as e:
    print(f"\\nStream interrupted: {e}")`}
              >
                <span className="t-kw">try</span>:{"\n"}
                {"    "}<span className="t-kw">for</span> chunk <span className="t-kw">in</span> conversation.<span className="t-fn">send_message_stream</span>(<span className="t-str">&quot;Write a long essay.&quot;</span>):{"\n"}
                {"        "}<span className="t-fn">print</span>(chunk, end=<span className="t-str">&quot;&quot;</span>){"\n"}
                <span className="t-kw">except</span> <span className="t-fn">Exception</span> <span className="t-kw">as</span> e:{"\n"}
                {"    "}<span className="t-fn">print</span>(<span className="t-str">f&quot;\\nStream interrupted: &#123;e&#125;&quot;</span>)
              </CodeBlock>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ RAG & MEMORY ═══ */}
          <section id="python-rag" ref={refs[4]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>RAG &amp; Persistent Memory</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              APIShift optionally supports FAISS-backed retrieval and JSONL-based persistent memory.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <CodeBlock
                label="faiss rag"
                copy={`conversation.add_to_faiss("The secret password is 'Swordfish'")

# RAG context is automatically injected into prompt budget
for chunk in conversation.send_message_stream("What is the secret password?"):
    print(chunk, end="")`}
              >
                <span className="t-cm"># Optional: requires faiss-cpu + sentence-transformers</span>{"\n"}
                conversation.<span className="t-fn">add_to_faiss</span>(<span className="t-str">&quot;The secret password is &apos;Swordfish&apos;&quot;</span>){"\n\n"}
                <span className="t-cm"># RAG context is automatically injected into prompt budget</span>{"\n"}
                <span className="t-kw">for</span> chunk <span className="t-kw">in</span> conversation.<span className="t-fn">send_message_stream</span>(<span className="t-str">&quot;What is the secret password?&quot;</span>):{"\n"}
                {"    "}<span className="t-fn">print</span>(chunk, end=<span className="t-str">&quot;&quot;</span>)
              </CodeBlock>

              <CodeBlock
                label="persistent memory"
                copy={`conversation = Conversation(
    providers,
    memory_path='.apishift/memory.jsonl',
)
# History and summaries survive process restarts`}
              >
                <span className="t-cm"># JsonMemoryStore: append-only JSONL backend</span>{"\n"}
                <span className="t-var">conversation</span> <span className="t-op">=</span> <span className="t-fn">Conversation</span>({"\n"}
                {"    "}providers,{"\n"}
                {"    "}<span className="t-var">memory_path</span>=<span className="t-str">&apos;.apishift/memory.jsonl&apos;</span>,{"\n"}
                ){"\n\n"}
                <span className="t-cm"># History and summaries survive process restarts</span>{"\n"}
                <span className="t-cm"># Older messages are summarized and trimmed automatically</span>
              </CodeBlock>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ CONTEXT PACKING ═══ */}
          <section id="python-context" ref={refs[5]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Context Packing</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Before each provider call, APIShift compiles messages into a token budget using <code className="mono" style={{ color: "var(--green-dim)" }}>pack_messages_to_token_budget</code>.
            </p>

            <div style={{ padding: "1rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--gray-300)", lineHeight: 1.8 }}>
              <strong style={{ color: "var(--white)" }}>Context compilation order:</strong>{"\n\n"}
              1. <span style={{ color: "var(--green-dim)" }}>system_prompt</span> — your static instructions{"\n"}
              2. <span style={{ color: "var(--green-dim)" }}>summary</span> — condensed older conversation history{"\n"}
              3. <span style={{ color: "var(--green-dim)" }}>retrieved context</span> — FAISS results for the latest query{"\n"}
              4. <span style={{ color: "var(--green-dim)" }}>recent messages</span> — newest turns, packed newest-first{"\n\n"}
              Token estimation: ~1 token per 4 characters (fast, dependency-free).{"\n"}
              If system context exceeds the budget, it&apos;s truncated from the left{"\n"}
              (preserving the most recent summary/retrieval text).
            </div>

            <div style={{ marginTop: "1rem" }}>
              <CodeBlock
                label="inspect compiled context"
                copy={`compiled = conversation.get_compiled_context()
for msg in compiled:
    print(f"{msg['role']}: {msg['content'][:80]}...")`}
              >
                <span className="t-cm"># Inspect what will be sent to the next provider call</span>{"\n"}
                <span className="t-var">compiled</span> = conversation.<span className="t-fn">get_compiled_context</span>(){"\n"}
                <span className="t-kw">for</span> msg <span className="t-kw">in</span> compiled:{"\n"}
                {"    "}<span className="t-fn">print</span>(<span className="t-str">f&quot;&#123;msg[&apos;role&apos;]&#125;: &#123;msg[&apos;content&apos;][:80]&#125;...&quot;</span>)
              </CodeBlock>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ EXCEPTIONS ═══ */}
          <section id="python-exceptions" ref={refs[6]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Exceptions</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              All exceptions inherit from <code className="mono" style={{ color: "var(--green-dim)" }}>MultiLLMManagerError</code>.
            </p>

            <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Exception</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>When</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--gray-500)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "RateLimitError", when: "HTTP 429 or rate-limit phrases detected", attrs: "provider, retry_after_seconds, status_code, headers" },
                    { name: "QuotaExceededError", when: "Daily/monthly quota exhausted", attrs: "provider, retry_after_seconds, status_code, headers" },
                    { name: "NoAvailableProvidersError", when: "All providers/keys exhausted", attrs: "message" },
                    { name: "ProviderInitializationError", when: "Missing SDK or empty key list", attrs: "provider, message" },
                  ].map((e, i) => (
                    <tr key={e.name} style={{ borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--red)" }}>{e.name}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--gray-300)" }}>{e.when}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--gray-500)", fontSize: "0.72rem" }}>{e.attrs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ PYTHON API REFERENCE ═══ */}
          <section id="python-api" ref={refs[7]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Python API Reference</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Complete constructor signatures and method reference.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h3 className="heading-sm" style={{ marginBottom: "0.75rem", color: "var(--green-dim)" }}>Conversation.__init__</h3>
                <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    <tbody>
                      {[
                        ["providers", "List[LLMProvider]", "[]", "Ordered list of providers"],
                        ["max_history_length", "int", "20", "Max recent messages kept"],
                        ["system_prompt", "str | None", "None", "Static system instructions"],
                        ["key_cooldown_seconds", "float", "60.0", "Default cooldown per key"],
                        ["key_strategy", "str", "'adaptive'", "adaptive, round_robin, or sticky"],
                        ["rag_top_k", "int", "3", "FAISS results per query"],
                        ["enable_rag", "bool", "True", "Enable FAISS indexing"],
                        ["summary_max_chars", "int", "4000", "Max summary length"],
                        ["memory_path", "str | None", "None", "JSONL persistence path"],
                        ["max_context_tokens", "int | None", "6000", "Token budget per call"],
                      ].map(([param, type, def, desc], i) => (
                        <tr key={param} style={{ borderBottom: i < 8 ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding: "0.5rem 0.75rem", color: "var(--white)", fontWeight: 600 }}>{param}</td>
                          <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-500)" }}>{type}</td>
                          <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-500)" }}>{def}</td>
                          <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-300)" }}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="heading-sm" style={{ marginBottom: "0.75rem", color: "var(--green-dim)" }}>Methods</h3>
                <ul className="cap-list">
                  {[
                    { name: "from_gemini_key_pool(api_keys, **kwargs)", desc: "Create the primary same-provider Gemini key-pool setup." },
                    { name: "send_message(message, **kwargs) → str", desc: "Send a message and get a full response. Key rotation and fallback are automatic." },
                    { name: "send_message_stream(message, **kwargs) → Iterator[str]", desc: "Stream a response. Pre-yield failover on rate limits." },
                    { name: "add_to_faiss(message)", desc: "Index text into the optional FAISS store for retrieval." },
                    { name: "retrieve_context(query, top_k) → List[str]", desc: "Retrieve semantically relevant stored snippets." },
                    { name: "get_history() → List[Dict]", desc: "Return a copy of the conversation history." },
                    { name: "get_compiled_context() → List[Dict]", desc: "Inspect the exact messages that will be sent on the next call." },
                    { name: "clear_history()", desc: "Clear history, summary, FAISS index, and memory store." },
                    { name: "add_provider(provider)", desc: "Add a provider at runtime. Re-sorts by free/priority." },
                  ].map((m) => (
                    <li key={m.name} className="cap-item">
                      <span className="cap-check">→</span>
                      <div className="cap-content">
                        <code style={{ fontSize: "0.82rem", color: "var(--white)", fontFamily: "var(--font-mono)" }}>{m.name}</code>
                        <div className="cap-desc">{m.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ TS QUICKSTART ═══ */}
          <section id="ts-quickstart" ref={refs[8]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>TypeScript Quick Start</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              <code className="mono" style={{ color: "var(--green-dim)" }}>@apishift/core</code> integrates with the Vercel AI SDK.
              Pass any <code className="mono" style={{ color: "var(--green-dim)" }}>LanguageModelV1</code> instance.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <CodeBlock label="terminal" copy="npm install @apishift/core ai @ai-sdk/google @ai-sdk/openai">
                <span className="t-op">$</span> npm install @apishift/core ai @ai-sdk/google @ai-sdk/openai
              </CodeBlock>

              <CodeBlock
                label="basic setup"
                copy={`import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';

const orchestrator = new APIShift([
  { provider: 'gemini', keyIndex: 0, name: 'gemini-key-1', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_1 }) },
  { provider: 'gemini', keyIndex: 1, name: 'gemini-key-2', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_2 }) },
], {
  keyStrategy: 'adaptive',
  systemPrompt: 'Continue the same task across key changes.',
});`}
              >
                {`import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';

const orchestrator = new APIShift([
  { provider: 'gemini', keyIndex: 0, name: 'gemini-key-1', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_1 }) },
  { provider: 'gemini', keyIndex: 1, name: 'gemini-key-2', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_2 }) },
], {
  keyStrategy: 'adaptive',
  systemPrompt: 'Continue the same task across key changes.',
});`}
              </CodeBlock>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ TS ORCHESTRATOR ═══ */}
          <section id="ts-orchestrator" ref={refs[9]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>APIShift Class (TS)</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              The orchestrator wraps <code className="mono" style={{ color: "var(--green-dim)" }}>generateText</code> and <code className="mono" style={{ color: "var(--green-dim)" }}>streamText</code> from the Vercel AI SDK,
              adding same-provider key pools, cooldowns, fallback, and context management.
            </p>

            <div>
              <h3 className="heading-sm" style={{ marginBottom: "0.75rem", color: "var(--green-dim)" }}>Constructor: new APIShift(models, options?)</h3>
              <div style={{ border: "1px solid var(--border)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  <tbody>
                    {[
                      ["models", "Array<LanguageModel | ModelEntry>", "Required", "Model instances with optional routing metadata"],
                      ["systemPrompt", "string", "''", "Static system instructions"],
                      ["maxHistoryLength", "number", "20", "Max recent messages kept"],
                      ["summaryMaxChars", "number", "4000", "Max summary length"],
                      ["defaultCooldownMs", "number", "60000", "Default cooldown per model/key entry"],
                      ["keyStrategy", "string", "'adaptive'", "adaptive, round_robin, or sticky"],
                      ["routingStrategy", "string", "'same_provider_first'", "Try all healthy keys in a provider pool before fallback"],
                      ["maxContextTokens", "number", "6000", "Token budget per call"],
                      ["memoryStore", "PersistentMemoryStore", "undefined", "JSONL or custom persistence"],
                    ].map(([param, type, def, desc], i) => (
                      <tr key={param} style={{ borderBottom: i < 6 ? "1px solid var(--border)" : "none" }}>
                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--white)", fontWeight: 600 }}>{param}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-500)" }}>{type}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-500)" }}>{def}</td>
                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray-300)" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ TS STREAMING ═══ */}
          <section id="ts-streaming" ref={refs[10]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>TypeScript Streaming</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Use <code className="mono" style={{ color: "var(--green-dim)" }}>streamMessage</code> for context-preserving streaming,
              or <code className="mono" style={{ color: "var(--green-dim)" }}>streamText</code> for stateless failover.
            </p>

            <CodeBlock
              label="streaming"
              copy={`const { textStream } = await orchestrator.streamMessage(
  'Explain the event loop in Node.js'
);

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}`}
            >
              <span className="t-kw">const</span> {"{"} <span className="t-var">textStream</span> {"}"} = <span className="t-kw">await</span> orchestrator.<span className="t-fn">streamMessage</span>({"\n"}
              {"  "}<span className="t-str">&apos;Explain the event loop in Node.js&apos;</span>{"\n"}
              );{"\n\n"}
              <span className="t-kw">for await</span> (<span className="t-kw">const</span> chunk <span className="t-kw">of</span> textStream) {"{"}{"\n"}
              {"  "}process.stdout.<span className="t-fn">write</span>(chunk);{"\n"}
              {"}"}
            </CodeBlock>
          </section>

          <hr className="rule" />

          {/* ═══ TS MEMORY ═══ */}
          <section id="ts-memory" ref={refs[11]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>TypeScript Memory</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              Use <code className="mono" style={{ color: "var(--green-dim)" }}>JsonMemoryStore</code> for JSONL-based persistence,
              or implement the <code className="mono" style={{ color: "var(--green-dim)" }}>PersistentMemoryStore</code> interface for custom backends.
            </p>

            <CodeBlock
              label="persistent memory"
              copy={`import { APIShift, JsonMemoryStore } from '@apishift/core';

const orchestrator = new APIShift(models, {
  memoryStore: new JsonMemoryStore('.apishift/memory.jsonl'),
});`}
            >
              <span className="t-kw">import</span> {"{"} <span className="t-fn">APIShift</span>, <span className="t-fn">JsonMemoryStore</span> {"}"} <span className="t-kw">from</span> <span className="t-str">&apos;@apishift/core&apos;</span>;{"\n\n"}
              <span className="t-kw">const</span> orchestrator = <span className="t-kw">new</span> <span className="t-fn">APIShift</span>(models, {"{"}{"\n"}
              {"  "}<span className="t-var">memoryStore</span>: <span className="t-kw">new</span> <span className="t-fn">JsonMemoryStore</span>(<span className="t-str">&apos;.apishift/memory.jsonl&apos;</span>),{"\n"}
              {"}"});
            </CodeBlock>

            <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--gray-300)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--white)" }}>PersistentMemoryStore interface:</strong>{"\n\n"}
              <span className="t-fn">load</span>() → {"{"} history, summary {"}"}{"\n"}
              <span className="t-fn">saveMessage</span>(message){"\n"}
              <span className="t-fn">saveSummary</span>(summary){"\n"}
              <span className="t-fn">clear</span>()
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ TS API REFERENCE ═══ */}
          <section id="ts-api" ref={refs[12]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>TypeScript API Reference</h2>

            <ul className="cap-list">
              {[
                { name: "generateText(params) → Promise", desc: "Stateless text generation with failover. Omit the model parameter." },
                { name: "streamText(params) → Promise", desc: "Stateless streaming with failover. First-chunk peeking strategy." },
                { name: "sendMessage(content, params?) → Promise", desc: "Context-preserving generation. History and summary managed automatically." },
                { name: "streamMessage(content, params?) → Promise", desc: "Context-preserving streaming. Chunks are auto-saved on stream completion." },
                { name: "getHistory() → Promise<ModelMessage[]>", desc: "Return the current conversation history." },
                { name: "getCompiledContext() → Promise<ModelMessage[]>", desc: "Inspect the compiled messages for the next call." },
                { name: "clearHistory() → Promise<void>", desc: "Clear history, summary, and memory store." },
                { name: "lastRoute: RouteInfo | undefined", desc: "Info about the last successful route (name, attempts, cooldown)." },
              ].map((m) => (
                <li key={m.name} className="cap-item">
                  <span className="cap-check">→</span>
                  <div className="cap-content">
                    <code style={{ fontSize: "0.82rem", color: "var(--white)", fontFamily: "var(--font-mono)" }}>{m.name}</code>
                    <div className="cap-desc">{m.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <hr className="rule" />

          {/* ═══ ARCHITECTURE ═══ */}
          <section id="architecture" ref={refs[13]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>Architecture</h2>
            <p className="body-text" style={{ marginBottom: "1.5rem" }}>
              How the same-provider key pool and fallback pipeline works internally.
            </p>

            <div style={{ padding: "1.25rem", border: "1px solid var(--border)", background: "var(--surface)", fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 2, color: "var(--gray-300)" }}>
              <span style={{ color: "var(--white)" }}>Request Flow:</span>{"\n\n"}
              <span style={{ color: "var(--green-dim)" }}>user message</span>{"\n"}
              {"  "}→ append to <span style={{ color: "var(--amber)" }}>history</span>{"\n"}
              {"  "}→ index in <span style={{ color: "var(--amber)" }}>FAISS</span> (optional){"\n"}
              {"  "}→ trim history → summarize overflow{"\n"}
              {"  "}→ compile context (<span style={{ color: "var(--amber)" }}>system + summary + RAG + recent</span>){"\n"}
              {"  "}→ pack to <span style={{ color: "var(--amber)" }}>token budget</span>{"\n"}
              {"  "}→ try primary provider pool{"\n"}
              {"    "}→ <span style={{ color: "var(--red)" }}>429/503?</span> cool down key → try next key → fallback if pool is blocked{"\n"}
              {"    "}→ <span style={{ color: "var(--green)" }}>success?</span> yield response → save to history{"\n"}
              {"  "}→ loop until success or <span style={{ color: "var(--red)" }}>NoAvailableProvidersError</span>{"\n\n"}
              <span style={{ color: "var(--white)" }}>Provider Selection:</span>{"\n\n"}
              {"  "}sort by: <span style={{ color: "var(--green-dim)" }}>free_tier</span> (True first) → <span style={{ color: "var(--green-dim)" }}>priority</span> (lower first){"\n"}
              {"  "}skip keys where: cooldown_until {">"} now{"\n"}
              {"  "}max attempts: total_key_count across all provider pools
            </div>
          </section>

          <hr className="rule" />

          {/* ═══ FAQ ═══ */}
          <section id="faq" ref={refs[14]} className="reveal">
            <h2 className="heading-lg" style={{ marginBottom: "1.5rem" }}>FAQ</h2>

            <ul className="cap-list">
              {[
                {
                  q: "What happens if all keys are rate-limited?",
                  a: "NoAvailableProvidersError is raised. Keys recover automatically after their cooldown period expires.",
                },
                {
                  q: "Does failover work mid-stream?",
                  a: "Only before the first chunk is yielded (pre-yield failover). Once bytes reach the caller, mid-stream errors are raised directly — restarting would duplicate/garble output.",
                },
                {
                  q: "Can I add fallback providers at runtime?",
                  a: "Yes. Call conversation.add_provider(provider). It is sorted after the primary pool based on free and priority metadata.",
                },
                {
                  q: "How does OpenRouter model discovery work?",
                  a: "APIShift queries the OpenRouter /api/v1/models endpoint for models with zero prompt and completion pricing. Falls back to hardcoded defaults if the network request fails.",
                },
                {
                  q: "What's the token counting accuracy?",
                  a: "The default counter uses ~4 chars/token heuristic. It's fast and dependency-free. For exact counts, pass a custom token_counter (e.g., tiktoken) via the constructor.",
                },
                {
                  q: "Can I use APIShift without the Vercel AI SDK?",
                  a: "Python: Yes, it's standalone. TypeScript: The orchestrator wraps generateText/streamText from the Vercel AI SDK, so that dependency is required.",
                },
                {
                  q: "Is FAISS required?",
                  a: "No. RAG is completely optional. Without faiss-cpu and sentence-transformers, APIShift works identically — just without semantic retrieval.",
                },
              ].map((item) => (
                <li key={item.q} className="cap-item">
                  <span className="cap-check" style={{ color: "var(--amber)" }}>?</span>
                  <div className="cap-content">
                    <div className="cap-title">{item.q}</div>
                    <div className="cap-desc">{item.a}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Footer */}
          <footer className="footer" style={{ marginTop: "2rem" }}>
            <div className="footer-inner" style={{ padding: 0 }}>
              <span>
                <span style={{ color: "var(--green)" }}>API</span>SHIFT · MIT
              </span>
              <div className="footer-links">
                <a href="/" className="footer-link">home</a>
                <a href="https://pypi.org/project/APIShift/" target="_blank" rel="noopener noreferrer" className="footer-link">pypi</a>
                <a href="https://www.npmjs.com/package/@apishift/core" target="_blank" rel="noopener noreferrer" className="footer-link">npm</a>
                <a href="https://github.com/Aditya190803/APIShift" target="_blank" rel="noopener noreferrer" className="footer-link">github</a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
