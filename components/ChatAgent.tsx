
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { ChatMessage, getChatResponse } from '../services/aiService';
import { AiProvider, AudienceType } from '../types';

interface ChatAgentProps {
  provider: AiProvider;
  audience: AudienceType;
  context: string;
}

const MAX_TURNS = 10;

const ChatAgent: React.FC<ChatAgentProps> = ({ provider, audience, context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || messages.length / 2 >= MAX_TURNS) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const response = await getChatResponse(provider, messages, context, userMsg.content, audience);
    
    setMessages([...newMessages, { role: 'assistant', content: response || "I'm sorry, I couldn't generate a response." }]);
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setIsOpen(false);
  };

  const turnsLeft = MAX_TURNS - Math.floor(messages.length / 2);

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-500/40 hover:bg-indigo-500 hover:scale-110 transition-all z-[200] group"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-2xl flex flex-col z-[200] animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">SSA AI Agent</h3>
              </div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                {provider} • {turnsLeft} Turns Left
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Reset Session"><Trash2 size={16} /></button>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20"><Bot size={32} className="text-indigo-400" /></div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Contextual Analyst Online</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">I'm synced with your dashboard. Ask me about your forecasts, inventory risks, or Pareto results.</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>
                  {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-indigo-400" />}
                </div>
                <div className={`max-w-[80%] p-3.5 rounded-2xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-100 rounded-tr-none' : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-tl-none'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border bg-slate-800 border-slate-700">
                  <Bot size={14} className="text-indigo-400" />
                </div>
                <div className="p-3.5 bg-slate-800/30 rounded-2xl border border-slate-800 flex items-center gap-2">
                  <Loader2 size={12} className="text-indigo-400 animate-spin" />
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Processing...</span>
                </div>
              </div>
            )}
            {turnsLeft === 0 && messages[messages.length-1]?.role === 'assistant' && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-center">
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Session Turn Limit Reached</p>
                <p className="text-[8px] text-slate-500 uppercase mt-1">Clear chat to start a new analysis</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-5 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <div className="relative group">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={isLoading || turnsLeft === 0}
                placeholder={turnsLeft > 0 ? "Ask about current data..." : "Limit reached"}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all pr-12 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading || turnsLeft === 0}
                className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:bg-slate-800 shadow-lg"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAgent;
