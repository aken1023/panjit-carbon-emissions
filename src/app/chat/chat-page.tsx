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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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

export function ChatPage({ userName }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    if (!content || isLoading) return;

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

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
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
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
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setStreamingContent("");
    setIsLoading(false);
  };

  const hasMessages = messages.length > 0 || streamingContent;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
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
        {hasMessages && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
            <Trash2 className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">清除對話</span>
            <span className="sm:hidden">清除</span>
          </Button>
        )}
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

            {/* Database badges */}
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

            {/* Suggested questions */}
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendMessage(q.question)}
                  className="flex items-start gap-2 rounded-xl border bg-card p-2.5 text-left text-sm transition-colors hover:bg-accent sm:gap-3 sm:p-3.5"
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
              <div key={message.id} className="flex gap-2 sm:gap-3">
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
                    <MarkdownContent content={streamingContent} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      思考中...
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
            <div className="hidden gap-1 sm:flex">
              {DB_BADGES.map((db) => (
                <span
                  key={db.label}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${db.color}`}
                >
                  {db.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Render markdown content with react-markdown + remark-gfm */
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-xs leading-relaxed sm:text-sm dark:prose-invert prose-headings:mt-3 prose-headings:mb-1.5 sm:prose-headings:mt-4 sm:prose-headings:mb-2 prose-p:my-1 prose-li:my-0.5 prose-table:text-[10px] sm:prose-table:text-xs prose-th:bg-muted/50 prose-th:px-1.5 prose-th:py-1 sm:prose-th:px-2 sm:prose-th:py-1.5 prose-td:px-1.5 prose-td:py-1 sm:prose-td:px-2 sm:prose-td:py-1.5 prose-th:border prose-td:border prose-th:border-border prose-td:border-border prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[10px] sm:prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:table sm:[&_table]:overflow-visible sm:[&_table]:whitespace-normal">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
