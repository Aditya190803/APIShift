"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   useReveal — IntersectionObserver scroll reveal
   ───────────────────────────────────────────── */
function useReveal(threshold = 0.12) {
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
   CopyButton — click to copy, changes to ✓
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
   TERMINAL DEMO — the centerpiece
   Plays a scripted failover sequence showing
   providers failing and text continuing seamlessly
   ───────────────────────────────────────────── */

type ProviderStatus = "active" | "standby" | "failed" | "shifting";

interface ProviderState {
  name: string;
  model: string;
  status: ProviderStatus;
}

interface LogLine {
  type: "prompt" | "text" | "event-error" | "event-shift" | "event-success" | "event-info" | "blank";
  content: string;
}

const INITIAL_PROVIDERS: ProviderState[] = [
  { name: "gemini-key-1", model: "gemini-3.5-flash", status: "standby" },
  { name: "gemini-key-2", model: "gemini-3.5-flash", status: "standby" },
  { name: "openrouter", model: "fallback", status: "standby" },
];

// The full response, split into segments routed through a primary key pool first
const SEGMENTS = [
  "Quantum computing uses quantum-mechanical phenomena — superposition and entanglement — to process information. Unlike classical bits that are strictly 0 or 1, ",
  "quantum bits (qubits) can exist in both states simultaneously. This parallelism lets quantum computers explore many solutions at once, ",
  "making them exponentially faster for specific problems like factoring, optimization, and simulating molecular systems.",
];

function TerminalDemo() {
  const [providers, setProviders] = useState<ProviderState[]>(INITIAL_PROVIDERS);
  const [log, setLog] = useState<LogLine[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState(-1); // -1 = idle/reset
  const bodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Auto-scroll the terminal body
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [log, streamedText]);

  // Helper: stream text char-by-char
  const streamChars = useCallback(
    (text: string, speed: number): Promise<void> => {
      return new Promise((resolve) => {
        let i = 0;
        const iv = setInterval(() => {
          if (abortRef.current) {
            clearInterval(iv);
            resolve();
            return;
          }
          if (i < text.length) {
            setStreamedText((prev) => prev + text[i]);
            i++;
          } else {
            clearInterval(iv);
            resolve();
          }
        }, speed);
      });
    },
    []
  );

  // Helper: wait
  const wait = useCallback((ms: number): Promise<void> => {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      // If aborted, resolve immediately
      const check = setInterval(() => {
        if (abortRef.current) {
          clearTimeout(t);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }, []);

  // Run the demo sequence
  useEffect(() => {
    if (phase !== 0) return;
    abortRef.current = false;

    const run = async () => {
      // Reset state
      setProviders(INITIAL_PROVIDERS);
      setLog([]);
      setStreamedText("");
      setIsStreaming(false);
      setShowCursor(true);

      await wait(600);

      // 1. Show prompt
      setLog([
        { type: "prompt", content: '> shift.stream("Explain quantum computing", pool="gemini")' },
        { type: "blank", content: "" },
      ]);

      await wait(800);

      // 2. Activate first Gemini key
      setProviders((p) =>
        p.map((pv) => (pv.name === "gemini-key-1" ? { ...pv, status: "active" } : pv))
      );
      setLog((prev) => [
        ...prev,
        { type: "event-info", content: "[00:00.0] routing → gemini/key-1 (primary pool)" },
        { type: "blank", content: "" },
      ]);

      await wait(500);

      // 3. Stream segment 0
      setIsStreaming(true);
      await streamChars(SEGMENTS[0], 22);

      await wait(300);

      // 4. FAIL gemini key 1
      setIsStreaming(false);
      setProviders((p) =>
        p.map((pv) => (pv.name === "gemini-key-1" ? { ...pv, status: "failed" } : pv))
      );
      // Freeze current streamed text into log
      setLog((prev) => [
        ...prev,
        { type: "text", content: SEGMENTS[0] },
        { type: "blank", content: "" },
        { type: "event-error", content: "[00:03.4] ✕ gemini/key-1 → 429 RATE LIMITED (cooldown: 62s)" },
      ]);
      setStreamedText("");

      await wait(400);

      // 5. Shift inside the same provider pool
      setProviders((p) =>
        p.map((pv) =>
          pv.name === "gemini-key-2" ? { ...pv, status: "active" } : pv.name === "gemini-key-1" ? { ...pv, status: "failed" } : pv
        )
      );
      setLog((prev) => [
        ...prev,
        { type: "event-shift", content: "[00:03.5] ↻ same provider → gemini/key-2 (context preserved)" },
        { type: "blank", content: "" },
      ]);

      await wait(600);

      // 6. Stream segment 1
      setIsStreaming(true);
      await streamChars(SEGMENTS[1], 22);

      await wait(300);

      // 7. FAIL Gemini key 2
      setIsStreaming(false);
      setProviders((p) =>
        p.map((pv) => (pv.name === "gemini-key-2" ? { ...pv, status: "failed" } : pv))
      );
      setLog((prev) => [
        ...prev,
        { type: "text", content: SEGMENTS[1] },
        { type: "blank", content: "" },
        { type: "event-error", content: "[00:06.8] ✕ gemini/key-2 → quota window reached" },
      ]);
      setStreamedText("");

      await wait(400);

      // 8. Shift to fallback provider after Gemini pool is blocked
      setProviders((p) =>
        p.map((pv) =>
          pv.name === "openrouter" ? { ...pv, status: "active" } : pv
        )
      );
      setLog((prev) => [
        ...prev,
        { type: "event-shift", content: "[00:06.9] ↻ fallback provider → openrouter (Gemini pool cooling down)" },
        { type: "blank", content: "" },
      ]);

      await wait(600);

      // 9. Stream segment 2 (final)
      setIsStreaming(true);
      await streamChars(SEGMENTS[2], 22);
      setIsStreaming(false);

      await wait(400);

      // 10. Done
      setLog((prev) => [
        ...prev,
        { type: "text", content: SEGMENTS[2] },
        { type: "blank", content: "" },
        { type: "event-success", content: "[00:10.2] ✓ response complete: same-provider keys first, 0 tokens lost" },
      ]);
      setStreamedText("");
      setShowCursor(false);

      // Wait then restart
      await wait(4000);
      if (!abortRef.current) {
        setPhase(-1);
      }
    };

    run();
  }, [phase, streamChars, wait]);

  // Auto-restart after reset
  useEffect(() => {
    if (phase !== -1) return;
    const t = setTimeout(() => setPhase(0), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // Start on mount
  useEffect(() => {
    setPhase(0);
    return () => {
      abortRef.current = true;
    };
  }, []);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">apishift terminal</span>
        <span style={{ fontSize: "0.65rem", color: "var(--gray-700)", fontFamily: "var(--font-mono)" }}>
          v1.0.0
        </span>
      </div>

      {/* Provider status bar */}
      <div className="provider-bar">
        {providers.map((p) => (
          <div key={p.name} className="provider-tag" data-status={p.status}>
            <span className="status-indicator" data-status={p.status === "active" ? "active" : p.status === "failed" ? "failed" : p.status === "shifting" ? "shifting" : "standby"} />
            {p.name}
          </div>
        ))}
      </div>

      {/* Terminal body */}
      <div
        ref={bodyRef}
        className="terminal-body"
        style={{ maxHeight: 360, overflowY: "auto" }}
      >
        {/* Rendered log lines */}
        {log.map((line, i) => {
          if (line.type === "blank") return <div key={i} style={{ height: "0.4em" }} />;
          if (line.type === "prompt")
            return (
              <div key={i} style={{ color: "var(--white)", fontWeight: 600 }}>
                {line.content}
              </div>
            );
          if (line.type === "text")
            return (
              <span key={i} style={{ color: "var(--gray-300)" }}>
                {line.content}
              </span>
            );
          // Events
          const eventClass =
            line.type === "event-error"
              ? "log-event log-event--error"
              : line.type === "event-shift"
              ? "log-event log-event--shift"
              : line.type === "event-success"
              ? "log-event log-event--success"
              : "log-event log-event--info";
          return (
            <span key={i} className={eventClass}>
              {line.content}
            </span>
          );
        })}

        {/* Currently streaming text */}
        {streamedText && (
          <span style={{ color: "var(--gray-300)" }}>{streamedText}</span>
        )}
        {showCursor && <span className="cursor-blink" />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────── */
export default function Home() {
  const [navScrolled, setNavScrolled] = useState(false);

  const heroRef = useReveal(0.08);
  const demoRef = useReveal(0.08);
  const installRef = useReveal(0.08);
  const capRef = useReveal(0.08);
  const ctaRef = useReveal(0.08);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const CAPABILITIES = [
    {
      title: "One provider, many keys",
      desc: "Pool 2, 5, or 50 keys from the same provider. APIShift treats them as one elastic capacity — not scattered credentials.",
    },
    {
      title: "Smart rotation, not round-robin",
      desc: "Skips cooling-down keys, spreads load by usage count, and respects Retry-After headers automatically.",
    },
    {
      title: "Fallback is the last resort",
      desc: "Cross-provider failover only triggers after every key in your primary pool has been tried or is cooling down.",
    },
    {
      title: "Zero context loss",
      desc: "Mid-conversation key or provider changes carry the full conversation history. The model never loses track.",
    },
    {
      title: "Stream-safe failover",
      desc: "Failover happens before tokens reach the client — not after. Works with Python generators and Vercel AI SDK streams.",
    },
    {
      title: "Know which key handled what",
      desc: "Inspect provider, pool, key label, attempts, and cooldowns after every call — without ever exposing raw API keys.",
    },
  ];

  return (
    <>
      {/* ══ NAV ══ */}
      <nav className={`nav ${navScrolled ? "nav--scrolled" : ""}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <em>API</em>SHIFT
          </a>
          <div className="nav-links">
            <a href="/docs" className="nav-link">docs</a>
            <a href="#demo" className="nav-link">demo</a>
            <a href="#install" className="nav-link">install</a>
            <a
              href="https://github.com/Aditya190803/APIShift"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              github
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div ref={heroRef} className="reveal container">
          <div className="hero-grid">
            {/* Left: headline */}
            <div>
              <div className="hero-tagline">
                Stop losing tokens to rate limits
              </div>
              <h1 className="hero-display">
                Your keys fail.
                <br />
                <span style={{ color: "var(--green)" }}>Your app doesn&apos;t.</span>
              </h1>

              <p className="hero-desc">
                One API key hits a rate limit and your entire pipeline stalls.
                APIShift pools your keys, rotates to healthy ones instantly,
                and only falls back when every key is cooling down.
              </p>
            </div>

            {/* Right: install + CTA */}
            <div>
              <div className="hero-install">
                <div className="label" style={{ marginBottom: "1rem" }}>Install</div>

                <div className="hero-install-row">
                  <span className="hero-install-lang">python</span>
                  <code
                    className="hero-install-cmd"
                    onClick={() => navigator.clipboard.writeText("pip install APIShift")}
                    title="Click to copy"
                  >
                    <span className="dollar">$ </span>
                    pip install APIShift
                  </code>
                </div>

                <div className="hero-install-row">
                  <span className="hero-install-lang">npm</span>
                  <code
                    className="hero-install-cmd"
                    onClick={() => navigator.clipboard.writeText("npm install @apishift/core")}
                    title="Click to copy"
                  >
                    <span className="dollar">$ </span>
                    npm install @apishift/core
                  </code>
                </div>
              </div>

              <div className="hero-ctas">
                <a href="#install" className="btn-solid">
                  Get started
                </a>
                <a href="#demo" className="btn-outline">
                  See the demo ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ══ LIVE DEMO ══ */}
      <section id="demo" className="section">
        <div ref={demoRef} className="reveal container">
          <div style={{ marginBottom: "3rem" }}>
            <span className="label" style={{ display: "block", marginBottom: "0.75rem" }}>
              See it break. See it recover.
            </span>
            <h2 className="heading-lg" style={{ marginBottom: "1rem" }}>
              Rate limited? Already shifted.
            </h2>
            <p className="body-text" style={{ maxWidth: 720 }}>
              Watch APIShift exhaust a Gemini key pool — keys fail, rotation kicks in, and when the whole pool is down, a fallback provider picks up mid-sentence without losing a single token.
            </p>
          </div>

          <TerminalDemo />

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: "2rem",
              marginTop: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { color: "var(--green)", label: "Active" },
              { color: "var(--amber)", label: "Shifting" },
              { color: "var(--red)", label: "Failed" },
              { color: "var(--gray-700)", label: "Standby" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--gray-500)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: s.color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ══ STATS ROW ══ */}
      <section className="section" style={{ padding: "clamp(3rem, 6vw, 5rem) 0" }}>
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              background: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            {[
              { value: "< 5ms", label: "Failover overhead" },
              { value: "0", label: "Tokens lost on shift" },
              { value: "3+", label: "Providers supported" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "var(--black)",
                  padding: "2.5rem 2rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(2rem, 4vw, 3rem)",
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    color: "var(--green)",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="label"
                  style={{ margin: 0 }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ══ INSTALL ══ */}
      <section id="install" className="section">
        <div ref={installRef} className="reveal container">
          <div style={{ marginBottom: "3rem" }}>
            <span className="label" style={{ display: "block", marginBottom: "0.75rem" }}>
              Three ways to start
            </span>
            <h2 className="heading-lg" style={{ marginBottom: "1rem" }}>
              Copy. Paste. Ship.
            </h2>
            <p className="body-text" style={{ maxWidth: 720 }}>
              Drop the agent prompt into Cursor, paste the Python snippet, or wire up the TypeScript SDK — you&apos;re resilient in under a minute.
            </p>
          </div>

          <div className="install-grid">
            {/* Coding Agent */}
            <div className="install-cell">
              <div className="install-cell-label">
                Coding Agent
                <CopyButton
                  text={`Add APIShift to my project as a Gemini API key pool with multiple account keys, adaptive rotation, streaming, memory persistence, and OpenRouter fallback only if the Gemini pool is cooling down`}
                />
              </div>
              <div className="install-cell-content" style={{ color: "var(--gray-300)" }}>
                <span style={{ color: "var(--gray-500)" }}>{"// Paste into Cursor, Windsurf, Claude Code\n// or any AI coding agent:\n\n"}</span>
                Add <span style={{ color: "var(--white)" }}>APIShift</span> to my project{"\n"}
                with a <span style={{ color: "var(--green-dim)" }}>Gemini key pool</span>{"\n"}
                using adaptive rotation,{"\n"}
                streaming, memory, and{"\n"}
                fallback only if needed at{"\n"}
                <span style={{ color: "var(--t-str)", fontStyle: "italic" }}>.apishift/memory.jsonl</span>
              </div>
            </div>

            {/* Python */}
            <div className="install-cell">
              <div className="install-cell-label">
                Python
                <CopyButton
                  text={`from APIShift import Conversation

conv = Conversation.from_gemini_key_pool(
    api_keys=['KEY_1', 'KEY_2', 'KEY_3'],
    key_strategy='adaptive',
    memory_path='.apishift/memory.jsonl',
)

for chunk in conv.send_message_stream("Hello"):
    print(chunk, end="", flush=True)`}
                />
              </div>
              <div className="install-cell-content">
                <span className="t-kw">from</span> <span className="t-fn">APIShift</span> <span className="t-kw">import</span> <span className="t-fn">Conversation</span>{"\n\n"}
                <span className="t-var">conv</span> <span className="t-op">=</span> <span className="t-fn">Conversation</span><span className="t-op">.</span><span className="t-fn">from_gemini_key_pool</span><span className="t-op">(</span>{"\n"}
                {"    "}<span className="t-var">api_keys</span><span className="t-op">=[</span><span className="t-str">&apos;KEY_1&apos;</span><span className="t-op">,</span> <span className="t-str">&apos;KEY_2&apos;</span><span className="t-op">,</span> <span className="t-str">&apos;KEY_3&apos;</span><span className="t-op">],</span>{"\n"}
                {"    "}<span className="t-var">key_strategy</span><span className="t-op">=</span><span className="t-str">&apos;adaptive&apos;</span><span className="t-op">,</span>{"\n"}
                {"    "}<span className="t-var">memory_path</span><span className="t-op">=</span><span className="t-str">&apos;.apishift/memory.jsonl&apos;</span><span className="t-op">,</span>{"\n"}
                <span className="t-op">)</span>{"\n\n"}
                <span className="t-kw">for</span> <span className="t-var">chunk</span> <span className="t-kw">in</span> <span className="t-var">conv</span><span className="t-op">.</span><span className="t-fn">send_message_stream</span><span className="t-op">(</span><span className="t-str">&quot;Hello&quot;</span><span className="t-op">):</span>{"\n"}
                {"    "}<span className="t-fn">print</span><span className="t-op">(</span><span className="t-var">chunk</span><span className="t-op">,</span> <span className="t-var">end</span><span className="t-op">=</span><span className="t-str">&quot;&quot;</span><span className="t-op">,</span> <span className="t-var">flush</span><span className="t-op">=</span><span className="t-kw">True</span><span className="t-op">)</span>
              </div>
            </div>

            {/* NPM / TypeScript */}
            <div className="install-cell">
              <div className="install-cell-label">
                TypeScript
                <CopyButton
                  text={`import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';

const shift = new APIShift([
  { provider: 'gemini', keyIndex: 0, name: 'gemini-key-1', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_1 }) },
  { provider: 'gemini', keyIndex: 1, name: 'gemini-key-2', model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_2 }) },
], { keyStrategy: 'adaptive' });

const { textStream } = await shift.streamMessage('Hello');`}
                />
              </div>
              <div className="install-cell-content">
                <span className="t-kw">import</span> <span className="t-op">{"{"}</span> <span className="t-fn">APIShift</span> <span className="t-op">{"}"}</span> <span className="t-kw">from</span> <span className="t-str">&apos;@apishift/core&apos;</span><span className="t-op">;</span>{"\n"}
                <span className="t-kw">import</span> <span className="t-op">{"{"}</span> <span className="t-fn">google</span> <span className="t-op">{"}"}</span> <span className="t-kw">from</span> <span className="t-str">&apos;@ai-sdk/google&apos;</span><span className="t-op">;</span>{"\n\n"}
                <span className="t-kw">const</span> <span className="t-var">shift</span> <span className="t-op">=</span> <span className="t-kw">new</span> <span className="t-fn">APIShift</span><span className="t-op">([</span>{"\n"}
                {"  "}<span className="t-op">{"{"}</span> <span className="t-var">provider</span><span className="t-op">:</span> <span className="t-str">&apos;gemini&apos;</span><span className="t-op">,</span> <span className="t-var">keyIndex</span><span className="t-op">:</span> <span className="t-num">0</span><span className="t-op">,</span>{"\n"}
                {"    "}<span className="t-var">model</span><span className="t-op">:</span> <span className="t-fn">google</span><span className="t-op">(</span><span className="t-str">&apos;gemini-1.5-flash&apos;</span><span className="t-op">,</span> <span className="t-op">{"{"}</span> <span className="t-var">apiKey</span><span className="t-op">:</span> <span className="t-var">process</span><span className="t-op">.</span><span className="t-var">env</span><span className="t-op">.</span><span className="t-var">GEMINI_KEY_1</span> <span className="t-op">{"}"}</span><span className="t-op">)</span> <span className="t-op">{"}"}</span><span className="t-op">,</span>{"\n"}
                {"  "}<span className="t-op">{"{"}</span> <span className="t-var">provider</span><span className="t-op">:</span> <span className="t-str">&apos;gemini&apos;</span><span className="t-op">,</span> <span className="t-var">keyIndex</span><span className="t-op">:</span> <span className="t-num">1</span><span className="t-op">,</span>{"\n"}
                {"    "}<span className="t-var">model</span><span className="t-op">:</span> <span className="t-fn">google</span><span className="t-op">(</span><span className="t-str">&apos;gemini-1.5-flash&apos;</span><span className="t-op">,</span> <span className="t-op">{"{"}</span> <span className="t-var">apiKey</span><span className="t-op">:</span> <span className="t-var">process</span><span className="t-op">.</span><span className="t-var">env</span><span className="t-op">.</span><span className="t-var">GEMINI_KEY_2</span> <span className="t-op">{"}"}</span><span className="t-op">)</span> <span className="t-op">{"}"}</span>{"\n"}
                <span className="t-op">],</span> <span className="t-op">{"{"}</span> <span className="t-var">keyStrategy</span><span className="t-op">:</span> <span className="t-str">&apos;adaptive&apos;</span> <span className="t-op">{"}"}</span><span className="t-op">);</span>{"\n\n"}
                <span className="t-kw">await</span> <span className="t-var">shift</span><span className="t-op">.</span><span className="t-fn">streamMessage</span><span className="t-op">(</span><span className="t-str">&apos;Hello&apos;</span><span className="t-op">);</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ══ CAPABILITIES ══ */}
      <section id="capabilities" className="section">
        <div ref={capRef} className="reveal container">
          <div style={{ marginBottom: "2rem" }}>
            <span className="label" style={{ display: "block", marginBottom: "0.75rem" }}>
              Built for production
            </span>
            <h2 className="heading-lg">Everything your API keys need.</h2>
          </div>

          <ul className="cap-list">
            {CAPABILITIES.map((cap) => (
              <li key={cap.title} className="cap-item scroll-reveal">
                <span className="cap-check">✓</span>
                <div className="cap-content">
                  <div className="cap-title">{cap.title}</div>
                  <div className="cap-desc">{cap.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <hr className="rule" />

      {/* ══ CTA ══ */}
      <section className="section">
        <div ref={ctaRef} className="reveal container">
          <h2 className="heading-lg" style={{ marginBottom: "1rem" }}>
            Stop babysitting API keys.
          </h2>
          <p className="body-text" style={{ marginBottom: "2rem" }}>
            Let APIShift handle rotation, cooldowns, and failover. You handle the product. Open source, MIT licensed, free forever.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="#install" className="btn-solid">
              Get started
            </a>
            <a
              href="https://github.com/Aditya190803/APIShift"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="footer">
        <div className="container footer-inner">
          <span>
            <span style={{ color: "var(--green)" }}>API</span>SHIFT · MIT
          </span>
          <div className="footer-links">
            <a href="https://pypi.org/project/APIShift/" target="_blank" rel="noopener noreferrer" className="footer-link">
              pypi
            </a>
            <a href="https://www.npmjs.com/package/@apishift/core" target="_blank" rel="noopener noreferrer" className="footer-link">
              npm
            </a>
            <a href="https://github.com/Aditya190803/APIShift" target="_blank" rel="noopener noreferrer" className="footer-link">
              github
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
