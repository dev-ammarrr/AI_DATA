'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send, User, Bot, RefreshCw, Camera } from 'lucide-react';
import type { ChatMessage } from '@/lib/supabase/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages(data || []);
      setLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const compressImage = (dataUrl: string, maxSize = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64);
        setSelectedImage(compressed);
        await sendWithImage(compressed);
      } catch {
        setSelectedImage(base64);
        await sendWithImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const sendWithImage = async (imageBase64: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: '📷 Receipt photo',
      metadata: null,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    await (supabase.from('chat_messages') as any).insert({
      user_id: user.id,
      role: 'user',
      content: '📷 Receipt photo',
    });

    setSending(true);
    setSelectedImage(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Extract this receipt and save it as a transaction' },
              { type: 'image', image: imageBase64 },
            ],
          }],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantContent = data.content || data.message || 'No response';

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
        metadata: null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      await (supabase.from('chat_messages') as any).insert({
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
      });
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: `❌ **Receipt error**: ${err.message || 'Unknown error'}`,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    }

    setSending(false);
  };

  const handleSubmit = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: text,
      metadata: null,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    await (supabase.from('chat_messages') as any).insert({
      user_id: user.id,
      role: 'user',
      content: text,
    });

    setSending(true);

    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      user_id: user.id,
      role: 'assistant',
      content: '',
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setStreamingId(assistantId);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, content: fullContent } : m))
        );
      }

      await (supabase.from('chat_messages') as any).insert({
        user_id: user.id,
        role: 'assistant',
        content: fullContent,
      });
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "I'm having trouble connecting right now. Please make sure your GROQ_API_KEY is set in .env.local and try again." }
            : m
        )
      );
    }

    setStreamingId(null);
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      <div className="p-6 lg:p-8 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-sky-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">AI Assistant</h1>
        </div>
        <p className="text-gray-500 text-sm">Ask anything about your finances</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <Bot className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-500 mb-1">Start a conversation</h3>
            <p className="text-sm text-gray-400">Ask about budgeting, saving, or financial planning.</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-sky-500" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-black text-white rounded-br-md'
                  : 'bg-gray-50 text-gray-700 rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{children}</code>,
                }}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {sending && !streamingId && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-sky-500" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-bl-md px-4 py-3">
              <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-4 lg:px-8">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="file"
            ref={fileRef}
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            className="p-3 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40 flex-shrink-0"
            title="Upload receipt"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Ask about your finances..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
          <button
            onClick={handleSubmit}
            disabled={sending || !input.trim()}
            className="p-3 rounded-xl bg-black text-white hover:bg-gray-800 transition-all disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
