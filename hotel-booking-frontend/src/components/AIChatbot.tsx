/**
 * hotel-booking-frontend/src/components/AIChatbot.tsx
 *
 * ── Changes in this version ───────────────────────────────────────────────────
 * 1. Updated quick prompts with worldwide cities (London, Dubai, Mumbai).
 * 2. "View all results" navigates to /search?destination=<city> — chatbot
 *    simply redirects; the search page fetches live data.
 * 3. Hotel cards use currency context for price display.
 * 4. External hotels in chat cards link to /detail/booking_<id> with cache.
 * 5. Removed any "View on Booking.com" references — all hotels link internally.
 * 6. Compact chat hotel card now shows "Pay at Hotel" badge for external.
 * 7. Session ring-buffer (last 5 messages) preserved.
 * 8. "Load more" pagination preserved.
 */

import React, {
  useState, useRef, useEffect, useCallback, useId,
} from "react";
import { Link} from "react-router-dom";
import { AiFillStar }        from "react-icons/ai";
import {
  MessageCircle, X, Send, Bot, User, MapPin, Loader2,
  ChevronDown, Sparkles, ExternalLink, ArrowRight, ChevronRight, CreditCard,
} from "lucide-react";
import { HotelType }      from "../../../shared/types";
import axiosInstance      from "../lib/api-client";
import { useCurrency }    from "../contexts/CurrencyContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatApiResponse {
  reply:         string;
  hotels:        HotelType[];
  total:         number;
  page:          number;
  pages:         number;
  sessionId:     string;
  searchPageUrl: string;
}

interface ChatMessage {
  id:            string;
  role:          "user" | "assistant";
  content:       string;
  hotels?:       any[];
  total?:        number;
  page?:         number;
  pages?:        number;
  searchPageUrl?: string;
  sourceQuery?:  string;
  timestamp:     Date;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: "🏙️ Hotels in London",    value: "Hotels in London"              },
  { label: "🏖️ Hotels in Dubai",     value: "5-star hotels in Dubai"         },
  { label: "💰 Budget under £100",   value: "Cheap hotels under £100"        },
  { label: "🇮🇳 Hotels in Mumbai",   value: "Hotels in Mumbai"              },
  { label: "⭐ Luxury 5-star",       value: "Luxury 5-star hotels"           },
  { label: "👨‍👩‍👧 Family friendly",   value: "Family friendly hotels"         },
] as const;

// ─── Small hotel card for chat panel ─────────────────────────────────────────

const ChatHotelCard = ({ hotel }: { hotel: any }) => {
  const { format, formatExternal } = useCurrency();
  const isExternal   = hotel.source === "external";
  const detailUrl    = `/detail/${hotel._id}`;

  // Cache external hotels so Detail page can load them
  if (isExternal && hotel._id) {
    window.__externalHotelCache = window.__externalHotelCache ?? {};
    window.__externalHotelCache[hotel._id] = hotel;
  }

  return (
    <Link
      to={detailUrl}
      className="flex gap-3 p-3 rounded-xl bg-white border border-slate-100
                 hover:border-primary-200 hover:shadow-md transition-all duration-200
                 group cursor-pointer"
    >
      <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
        <img
          src={hotel.imageUrls?.[0] ?? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=60"}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary-600 transition-colors">
          {hotel.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500 truncate">{hotel.city}, {hotel.country}</p>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(hotel.starRating ?? 0, 5) }).map((_: any, i: number) => (
              <AiFillStar key={i} className="w-3 h-3 text-amber-400" />
            ))}
          </div>
          {hotel.pricePerNight > 0 ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isExternal ? "text-emerald-700 bg-emerald-50" : "text-primary-600 bg-primary-50"}`}>
              {isExternal
                ? formatExternal(hotel.pricePerNight, hotel.currency ?? "INR")
                : format(hotel.pricePerNight)
              }/night
            </span>
          ) : (
            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
              Price on request
            </span>
          )}
        </div>
        {isExternal && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              <CreditCard className="w-2.5 h-2.5" /> Pay at hotel
            </span>
          </div>
        )}
      </div>

      <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <ExternalLink className="w-3.5 h-3.5 text-primary-400" />
      </div>
    </Link>
  );
};

// ─── Message bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg:           ChatMessage;
  onLoadMore:    (query: string, nextPage: number) => void;
  isLoadingMore: boolean;
}

const MessageBubble = ({ msg, onLoadMore, isLoadingMore }: MessageBubbleProps) => {
  const isUser    = msg.role === "user";
  const canLoadMore =
    msg.hotels && msg.total !== undefined &&
    msg.total > (msg.hotels?.length ?? 0) &&
    (msg.page ?? 1) < (msg.pages ?? 1) &&
    msg.sourceQuery;

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
          ${isUser ? "bg-primary-600 text-white" : "bg-gradient-to-br from-violet-500 to-primary-600 text-white"}`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line
            ${isUser
              ? "bg-primary-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"
            }`}
        >
          {msg.content.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
            chunk.startsWith("**") && chunk.endsWith("**")
              ? <strong key={i}>{chunk.slice(2, -2)}</strong>
              : <span key={i}>{chunk}</span>
          )}
        </div>

        {msg.hotels && msg.hotels.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            {msg.hotels.map((hotel) => (
              <ChatHotelCard key={hotel._id} hotel={hotel} />
            ))}
          </div>
        )}

        {!isUser && msg.hotels && msg.hotels.length > 0 && (
          <div className="w-full flex flex-col gap-1.5">
            {canLoadMore && (
              <button
                onClick={() => onLoadMore(msg.sourceQuery!, (msg.page ?? 1) + 1)}
                disabled={isLoadingMore}
                className="w-full flex items-center justify-center gap-2 py-2 px-3
                           text-xs font-semibold text-primary-700 bg-primary-50
                           hover:bg-primary-100 border border-primary-200
                           rounded-xl transition-all duration-150 disabled:opacity-50"
              >
                {isLoadingMore
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                  : <><ChevronRight className="w-3.5 h-3.5" /> Load more ({(msg.total ?? 0) - (msg.hotels?.length ?? 0)} more)</>
                }
              </button>
            )}

            {msg.searchPageUrl && (msg.total ?? 0) > 0 && (
              <Link
                to={msg.searchPageUrl}
                className="w-full flex items-center justify-center gap-2 py-2 px-3
                           text-xs font-semibold text-white bg-gradient-to-r
                           from-primary-600 to-primary-700 hover:from-primary-700
                           hover:to-primary-800 rounded-xl transition-all duration-150 shadow-sm"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                View all {msg.total} results
              </Link>
            )}
          </div>
        )}

        <span className="text-[10px] text-slate-400 px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
};

// ─── Typing indicator ──────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex gap-2.5">
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center flex-shrink-0">
      <Bot className="w-3.5 h-3.5 text-white" />
    </div>
    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

// Extend Window type for external hotel cache
declare global {
  interface Window { __externalHotelCache?: Record<string, any>; }
}

const AIChatbot: React.FC = () => {
  const [isOpen,        setIsOpen]        = useState(false);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [inputValue,    setInputValue]    = useState("");
  const [isLoading,     setIsLoading]     = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sessionId,     setSessionId]     = useState<string>("");
  const [hasUnread,     setHasUnread]     = useState(false);
  const [showScroll,    setShowScroll]    = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const uid            = useId();
  //const navigate       = useNavigate();

  // Welcome message
  useEffect(() => {
    setMessages([{
      id:        `${uid}-welcome`,
      role:      "assistant",
      content:   "Hi! 👋 I'm your worldwide hotel search assistant.\n\nAsk me anything like:\n• **\"Hotels in London\"**\n• **\"5-star hotels in Dubai\"**\n• **\"Cheap hotels under £100\"**",
      timestamp: new Date(),
    }]);
  }, [uid]);

  // Auto-scroll
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  useEffect(() => { if (isOpen) setTimeout(() => scrollToBottom(false), 60); }, [isOpen, scrollToBottom]);
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isLoading, isOpen, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  useEffect(() => {
    if (!isOpen && messages.some((m) => m.role === "assistant" && m.hotels?.length))
      setHasUnread(true);
  }, [messages, isOpen]);

  const handleOpen = () => { setIsOpen(true); setHasUnread(false); setTimeout(() => inputRef.current?.focus(), 200); };

  // Core API call
  const callChatApi = useCallback(async (text: string, page = 1, isMore = false) => {
    try {
      const { data } = await axiosInstance.post<ChatApiResponse>("/api/ai/chat", {
        message: text, sessionId: sessionId || undefined, page, limit: 5,
      });

      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      // Cache any external hotels so Detail page can load them
      (data.hotels ?? []).forEach((h: any) => {
        if (h.source === "external" && h._id) {
          window.__externalHotelCache = window.__externalHotelCache ?? {};
          window.__externalHotelCache[h._id] = h;
        }
      });

      if (isMore) {
        setMessages((prev) => {
          const copy = [...prev];
          const idx  = copy.map((m) => m.role).lastIndexOf("assistant");
          if (idx !== -1) {
            copy[idx] = {
              ...copy[idx],
              hotels:        [...(copy[idx].hotels ?? []), ...(data.hotels ?? [])],
              total:         data.total,
              page:          data.page,
              pages:         data.pages,
              searchPageUrl: data.searchPageUrl,
            };
          }
          return copy;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id:            `${uid}-bot-${Date.now()}`,
            role:          "assistant",
            content:       data.reply,
            hotels:        data.hotels,
            total:         data.total,
            page:          data.page,
            pages:         data.pages,
            searchPageUrl: data.searchPageUrl,
            sourceQuery:   text,
            timestamp:     new Date(),
          },
        ]);
      }
    } catch {
      if (!isMore) {
        setMessages((prev) => [...prev, {
          id: `${uid}-err-${Date.now()}`, role: "assistant",
          content: "Sorry, something went wrong. Please try again.", timestamp: new Date(),
        }]);
      }
    }
  }, [sessionId, uid]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, {
      id: `${uid}-user-${Date.now()}`, role: "user", content: trimmed, timestamp: new Date(),
    }]);
    setInputValue("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    setIsLoading(true);
    await callChatApi(trimmed, 1, false);
    setIsLoading(false);
  }, [isLoading, uid, callChatApi]);

  const handleLoadMore = useCallback(async (query: string, nextPage: number) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    await callChatApi(query, nextPage, true);
    setIsLoadingMore(false);
  }, [isLoadingMore, callChatApi]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  const clearChat = () => {
    setSessionId("");
    setMessages([{
      id: `${uid}-clear-${Date.now()}`, role: "assistant",
      content: "Chat cleared! Ask me about hotels anywhere in the world. 🌍", timestamp: new Date(),
    }]);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        aria-label={isOpen ? "Close chat" : "Open hotel assistant"}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 ease-out
          ${isOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 hover:scale-110"}`}
      >
        {isOpen ? <X className="w-5 h-5 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {hasUnread && !isOpen && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary-400 opacity-30 animate-ping pointer-events-none" />
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-1.5rem)]
          bg-slate-50 rounded-2xl overflow-hidden shadow-2xl border border-slate-200
          flex flex-col transition-all duration-300 ease-out origin-bottom-right
          ${isOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 translate-y-4 pointer-events-none"}`}
        style={{ height: "600px", maxHeight: "calc(100vh - 7rem)" }}
        role="dialog"
        aria-label="Hotel AI assistant"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Hotel Assistant</p>
              <p className="text-[10px] text-primary-200">Worldwide hotel search</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearChat} className="text-primary-200 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs">Clear</button>
            <button onClick={() => setIsOpen(false)} className="text-primary-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onLoadMore={handleLoadMore} isLoadingMore={isLoadingMore} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {showScroll && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-[130px] right-4 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 transition-all z-10"
          >
            <ChevronDown className="w-4 h-4 text-slate-600" />
          </button>
        )}

        {/* Quick prompts */}
        <div className="border-t border-slate-200 px-3 pt-2.5 pb-1 flex-shrink-0 bg-white">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_PROMPTS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => sendMessage(value)}
                disabled={isLoading}
                className="text-[11px] bg-slate-50 border border-slate-200 text-slate-600
                           hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50
                           rounded-full px-2.5 py-1 transition-all duration-150
                           whitespace-nowrap font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 bg-white px-3 py-2.5 flex-shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder='Try "5-star hotels in Paris under £300"…'
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none px-3.5 py-2.5 focus:outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: "40px", maxHeight: "100px" }}
              />
            </div>
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send message"
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150
                ${isLoading || !inputValue.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700 hover:scale-105 shadow-sm"}`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            Searches live global hotel database · Enter to send
          </p>
        </div>
      </div>
    </>
  );
};

export default AIChatbot;