"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Database,
  Leaf,
  Globe,
  Factory,
  HelpCircle,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Coins,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costNtd: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  usage?: TokenUsage;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  {
    icon: Leaf,
    label: "台灣電力排放係數",
    question: "台灣最新的電力排放係數是多少？來源是什麼？",
  },
  {
    icon: Factory,
    label: "半導體 Scope 3",
    question: "半導體封裝業如何估算 Scope 3 採購商品的碳排放？有哪些排放係數可以用？",
  },
  {
    icon: Globe,
    label: "中國電網排放因子",
    question: "中國各區域電網（華東、華南等）的排放因子分別是多少？資料來源為何？",
  },
  {
    icon: Database,
    label: "比較四大資料庫",
    question: "EEIO、SimaPro/ecoinvent、台灣環境部碳足跡資訊網、中國CPCD，這四個排放係數資料庫各有什麼特色？我該如何選擇？",
  },
  {
    icon: HelpCircle,
    label: "天然氣碳排計算",
    question: "我們工廠一個月使用 5,000 立方公尺的天然氣，請幫我計算碳排放量，並說明計算過程。",
  },
  {
    icon: Globe,
    label: "ecoinvent 查詢",
    question: "ecoinvent 資料庫有哪些免費的替代方案？如何透過 API 程式化存取 LCA 排放係數？",
  },
];

const DB_BADGES = [
  { label: "EEIO / USEEIO", color: "bg-blue-100 text-blue-700" },
  { label: "SimaPro / ecoinvent", color: "bg-purple-100 text-purple-700" },
  { label: "台灣環境部 CFP", color: "bg-green-100 text-green-700" },
  { label: "中國 CPCD", color: "bg-orange-100 text-orange-700" },
];

interface ChatPageProps {
  userName: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChatPage({ userName }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false); // prevent double-send

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Session token totals
  const [sessionTokens, setSessionTokens] = useState({ total: 0, costNtd: 0 });

  // Load conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch { /* ignore */ }
  };

  // Load a specific conversation
  const loadConversation = async (convoId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convoId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvoId(convoId);
      setMessages(
        data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; promptTokens: number; completionTokens: number; costNtd: number; timestamp: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
          usage: m.promptTokens
            ? {
                promptTokens: m.promptTokens,
                completionTokens: m.completionTokens,
                totalTokens: m.promptTokens + m.completionTokens,
                costNtd: m.costNtd,
              }
            : undefined,
        }))
      );
      // Calculate session totals
      let total = 0, cost = 0;
      for (const m of data.messages) {
        total += (m.promptTokens || 0) + (m.completionTokens || 0);
        cost += m.costNtd || 0;
      }
      setSessionTokens({ total, costNtd: cost });
      setSidebarOpen(false);
    } catch { /* ignore */ }
  };

  // Create new conversation
  const startNewConversation = () => {
    setActiveConvoId(null);
    setMessages([]);
    setStreamingContent("");
    setSessionTokens({ total: 0, costNtd: 0 });
    setIsLoading(false);
    setSidebarOpen(false);
  };

  // Delete conversation
  const deleteConversation = async (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${convoId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convoId));
      if (activeConvoId === convoId) startNewConversation();
    } catch { /* ignore */ }
  };

  // Save message to DB
  const saveMessageToDB = async (
    convoId: string,
    role: string,
    content: string,
    usage?: TokenUsage
  ) => {
    try {
      await fetch(`/api/conversations/${convoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          costNtd: usage?.costNtd ?? 0,
        }),
      });
    } catch { /* ignore */ }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;

    // Double-send guard: use ref to prevent race conditions
    if (sendingRef.current) return;
    sendingRef.current = true;

    // Abort any in-flight request first
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Ensure we have a conversation
    let convoId = activeConvoId;
    if (!convoId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: content.slice(0, 60) }),
        });
        if (res.ok) {
          const data = await res.json();
          convoId = data.id;
          setActiveConvoId(convoId);
        }
      } catch { /* ignore */ }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Save user message to DB
    if (convoId) saveMessageToDB(convoId, "user", content);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      chatHistory.push({ role: "user" as const, content });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "請求失敗");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("無法讀取串流");

      const decoder = new TextDecoder();
      let accumulated = "";
      let usage: TokenUsage | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setStreamingContent(accumulated);
              }
              if (parsed.usage) {
                usage = parsed.usage as TokenUsage;
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: accumulated,
        timestamp: new Date(),
        usage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");

      // Update session totals
      if (usage) {
        setSessionTokens((prev) => ({
          total: prev.total + usage!.totalTokens,
          costNtd: prev.costNtd + usage!.costNtd,
        }));
      }

      // Save assistant message to DB
      if (convoId) saveMessageToDB(convoId, "assistant", accumulated, usage);

      // Refresh conversation list
      fetchConversations();
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `抱歉，發生錯誤：${error instanceof Error ? error.message : "未知錯誤"}。請稍後再試。`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0 || streamingContent;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* History sidebar */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30 transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden sm:w-10"
        )}
      >
        {/* Toggle button (always visible on sm+) */}
        <div className="hidden sm:flex h-12 items-center justify-center border-b">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded p-1 hover:bg-accent"
            title={sidebarOpen ? "收合歷史" : "展開歷史"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <div className="flex items-center justify-between p-2 border-b">
              <span className="text-xs font-medium text-muted-foreground px-1">歷史對話</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewConversation}
                className="h-7 px-2 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                新對話
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {conversations.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  尚無對話記錄
                </p>
              )}
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => loadConversation(convo.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors group",
                    activeConvoId === convo.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-muted-foreground"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2 leading-tight">{convo.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(convo.id, e)}
                      className="hidden group-hover:block shrink-0 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile history toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-1 hover:bg-accent sm:hidden"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-9 sm:w-9">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold sm:text-base">排放係數 AI 助理</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                整合四大排放係數資料庫，協助碳盤查與碳足跡計算
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewConversation}
                className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
              >
                <Plus className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">新對話</span>
              </Button>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Welcome screen */
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-3 py-4 sm:px-4 sm:py-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 sm:mb-6 sm:h-16 sm:w-16">
                <Bot className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
              </div>
              <h2 className="mb-1 text-lg font-bold sm:mb-2 sm:text-xl">
                {userName}，您好！
              </h2>
              <p className="mb-3 text-center text-sm text-muted-foreground sm:mb-4 sm:text-base">
                我是碳排管理 AI 助理，整合以下四大排放係數資料庫為您服務：
              </p>
              <div className="mb-5 flex flex-wrap justify-center gap-1.5 sm:mb-8 sm:gap-2">
                {DB_BADGES.map((db) => (
                  <span
                    key={db.label}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-3 sm:py-1 sm:text-xs ${db.color}`}
                  >
                    {db.label}
                  </span>
                ))}
              </div>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.question)}
                    disabled={isLoading}
                    className="flex items-start gap-2 rounded-xl border bg-card p-2.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50 disabled:pointer-events-none sm:gap-3 sm:p-3.5"
                  >
                    <q.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium sm:text-sm">{q.label}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 sm:text-xs">
                        {q.question}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 lg:px-6">
              {messages.map((message) => (
                <div key={message.id}>
                  <div className="flex gap-2 sm:gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5 sm:pt-1">
                      <p className="mb-0.5 text-[10px] font-medium text-muted-foreground sm:mb-1 sm:text-xs">
                        {message.role === "user" ? userName : "AI 助理"}
                      </p>
                      <MarkdownContent content={message.content} />
                      {/* Token usage display for assistant messages */}
                      {message.role === "assistant" && message.usage && (
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                          <span>
                            Tokens: {message.usage.promptTokens.toLocaleString()} + {message.usage.completionTokens.toLocaleString()} = {message.usage.totalTokens.toLocaleString()}
                          </span>
                          <span>
                            NT$ {message.usage.costNtd.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {isLoading && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-8 sm:w-8">
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5 sm:pt-1">
                    <p className="mb-0.5 text-[10px] font-medium text-muted-foreground sm:mb-1 sm:text-xs">
                      AI 助理
                    </p>
                    {streamingContent ? (
                      <StreamingMarkdownContent content={streamingContent} />
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          搜尋網路資料中...
                        </div>
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t bg-background px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 sm:gap-3">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="輸入您的問題..."
                  rows={1}
                  className="w-full resize-none rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm outline-none ring-ring/50 focus:ring-2 disabled:opacity-50 sm:px-4 sm:py-3 sm:pr-12"
                  disabled={isLoading}
                  style={{ maxHeight: "160px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height =
                      Math.min(target.scrollHeight, 160) + "px";
                  }}
                />
                <Button
                  size="icon-sm"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between sm:mt-2">
              <p className="text-[9px] text-muted-foreground sm:text-[10px]">
                <span className="hidden sm:inline">AI 回覆僅供參考，排放係數請以官方公告為準。</span>按 Enter 送出，Shift+Enter 換行
              </p>
              {/* Session token cost - right side */}
              <div className="flex items-center gap-2">
                {sessionTokens.total > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                    <Coins className="h-3 w-3" />
                    <span>{sessionTokens.total.toLocaleString()} tokens</span>
                    <span className="font-medium text-foreground/70">
                      NT$ {sessionTokens.costNtd.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mermaid + Markdown rendering
// ---------------------------------------------------------------------------

/** Global counter to ensure unique mermaid render IDs */
let mermaidCounter = 0;
let mermaidInitialized = false;

const MERMAID_KEYWORDS = [
  "flowchart ",
  "flowchart\n",
  "graph ",
  "graph\n",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "gantt",
  "pie",
  "gitgraph",
  "journey",
  "mindmap",
  "timeline",
  "C4Context",
  "C4Container",
];

function isMermaidCode(text: string): boolean {
  const trimmed = text.trim();
  return MERMAID_KEYWORDS.some((kw) => trimmed.startsWith(kw));
}

const PROSE_CLASSES =
  "prose prose-sm max-w-none text-xs leading-relaxed sm:text-sm dark:prose-invert prose-headings:mt-3 prose-headings:mb-1.5 sm:prose-headings:mt-4 sm:prose-headings:mb-2 prose-p:my-1 prose-li:my-0.5 prose-table:text-[10px] sm:prose-table:text-xs prose-th:bg-muted/50 prose-th:px-1.5 prose-th:py-1 sm:prose-th:px-2 sm:prose-th:py-1.5 prose-td:px-1.5 prose-td:py-1 sm:prose-td:px-2 sm:prose-td:py-1.5 prose-th:border prose-td:border prose-th:border-border prose-td:border-border prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[10px] sm:prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:table sm:[&_table]:overflow-visible sm:[&_table]:whitespace-normal";

/** Render mermaid diagrams in a container (debounced, only after streaming finishes) */
function renderMermaidInContainer(el: HTMLElement) {
  const codeBlocks = el.querySelectorAll("pre code");
  codeBlocks.forEach((codeEl) => {
    const text = codeEl.textContent || "";
    if (!isMermaidCode(text)) return;

    const pre = codeEl.parentElement;
    if (!pre || pre.getAttribute("data-mermaid") === "done") return;
    pre.setAttribute("data-mermaid", "done");

    const wrapper = document.createElement("div");
    wrapper.className =
      "my-3 overflow-x-auto rounded-xl border bg-white p-3 dark:bg-gray-950 max-h-[420px] overflow-y-auto";
    wrapper.innerHTML = `<div class="flex items-center gap-2 text-xs text-gray-400"><svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>圖表載入中...</div>`;
    pre.replaceWith(wrapper);

    const id = `mmd-${Date.now()}-${++mermaidCounter}`;

    import("mermaid")
      .then(({ default: mermaid }) => {
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "loose",
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: "basis",
              nodeSpacing: 30,
              rankSpacing: 30,
            },
            fontSize: 12,
          });
          mermaidInitialized = true;
        }
        return mermaid.render(id, text.trim());
      })
      .then(({ svg }) => {
        wrapper.innerHTML = svg;
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
          svgEl.style.maxHeight = "380px";
          svgEl.style.margin = "0 auto";
          svgEl.style.display = "block";
          svgEl.removeAttribute("width");
        }
      })
      .catch(() => {
        wrapper.className =
          "my-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300";
        wrapper.innerHTML = `<p class="mb-1 font-medium">流程圖渲染失敗</p><pre class="whitespace-pre-wrap font-mono text-[10px]">${text.replace(/</g, "&lt;")}</pre>`;
        document.getElementById(id)?.remove();
      });
  });
}

/**
 * MarkdownContent for finalized messages — renders mermaid diagrams.
 * Only processes mermaid ONCE after mount (not on every re-render).
 */
function MarkdownContent({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Only process mermaid once per content snapshot
    if (processedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    // Small delay to ensure ReactMarkdown has finished rendering
    const timer = setTimeout(() => {
      renderMermaidInContainer(el);
      processedRef.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, [content]);

  // Reset processed flag when content changes
  useEffect(() => {
    processedRef.current = false;
  }, [content]);

  return (
    <div ref={containerRef} className={PROSE_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * StreamingMarkdownContent — for in-progress streaming messages.
 * Does NOT attempt mermaid rendering to avoid performance issues.
 */
function StreamingMarkdownContent({ content }: { content: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
