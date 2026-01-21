# APIShift Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade APIShift Python to support streaming, improve documentation, and scaffold a universal NPM package using Vercel AI SDK principles.

**Architecture:** 
- **Python**: Refactor `LLMProvider` to include `generate_stream`. Use `yield` for streaming responses. Update `Conversation` to handle both sync and stream modes.
- **NPM**: Build a TypeScript package that wraps `@ai-sdk/google`, `@ai-sdk/openai`, etc., providing a `SmartOrchestrator` that handles key rotation and failover.

**Tech Stack:** 
- **Python**: `requests`, `httpx`, `sentence-transformers`, `faiss-cpu`.
- **NPM**: `typescript`, `ai`, `zod`.

## Phase 1: Python Streaming & Improvements

### Task 1: Update Dependencies
**Files:**
- Modify: `requirements.txt`
- Modify: `pyproject.toml`

**Step 1: Add httpx to requirements**
**Step 2: Commit changes**

### Task 2: Refactor Base Provider for Streaming
**Files:**
- Modify: `APIShift/providers.py`

**Step 1: Add abstract `generate_stream`**
**Step 2: Update `OpenRouterProvider` to use `httpx` for streaming**
**Step 3: Update `GeminiProvider` for streaming**

### Task 3: Update Conversation for Streaming
**Files:**
- Modify: `APIShift/conversation.py`

**Step 1: Implement `send_message_stream`**
**Step 2: Add auto-failover logic to streaming**

## Phase 2: NPM Package Scaffold

### Task 4: Project Initialization
**Files:**
- Create: `package.json`, `tsconfig.json`

### Task 5: Core Orchestrator
**Files:**
- Create: `src/orchestrator.ts` (The Vercel AI SDK wrapper)

## Phase 3: Documentation

### Task 6: Comprehensive Docs
**Files:**
- Modify: `README.md`
- Create: `docs/PYTHON_STREAMING.md`
- Create: `docs/NPM_GUIDE.md`
