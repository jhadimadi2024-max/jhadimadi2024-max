import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, X } from 'lucide-react';

interface FloatingAiChatWidgetProps {
  isOpen: boolean;
  onOpenChat: () => void;
  lang?: 'bn' | 'en';
}

export const FloatingAiChatWidget: React.FC<FloatingAiChatWidgetProps> = ({
  isOpen,
  onOpenChat,
  lang = 'bn',
}) => {
  const [showTeaser, setShowTeaser] = useState(true);

  // Auto-hide teaser bubble after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTeaser(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  if (isOpen) {
    return null;
  }

  return (
    <aside 
      aria-label="Jhadimadi AI Assistant"
      className="fixed bottom-14 right-3 sm:bottom-6 sm:right-6 z-40 flex items-end flex-col gap-2 select-none"
    >
      {/* Speech bubble teaser */}
      {showTeaser && (
        <div 
          className="bg-white text-slate-800 text-xs sm:text-sm font-medium py-2 px-3 rounded-2xl shadow-xl border border-emerald-100 flex items-center gap-2 animate-bounce transition-all duration-300 relative group cursor-pointer max-w-[200px] sm:max-w-xs"
          onClick={onOpenChat}
        >
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <p className="line-clamp-2 leading-snug">
            {lang === 'en' 
              ? 'Looking for products? Chat with Jhadimadi AI!' 
              : 'পাহাড়ি খাঁটি পণ্য খুঁজছেন? আমাকে বলুন!'}
          </p>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTeaser(false);
            }}
            className="text-slate-400 hover:text-slate-600 p-0.5 ml-1"
            title="বন্ধ করুন"
          >
            <X className="w-3 h-3" />
          </button>
          {/* Arrow */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-b border-r border-emerald-100 transform rotate-45"></div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        id="floating-jhadimadi-ai-btn"
        onClick={onOpenChat}
        className="group flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white pl-3.5 pr-4 py-2.5 sm:py-3 rounded-full shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 transform active:scale-95 border-2 border-white/20 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
        title={lang === 'en' ? 'Jhadimadi AI Sales Assistant' : 'ঝাদিমাদি এআই সেলস অ্যাসিস্ট্যান্ট'}
      >
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 fill-amber-300/40 animate-pulse" />
          </div>
          {/* Online green indicator dot */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-emerald-700"></span>
          </span>
        </div>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-black tracking-tight leading-tight">
              {lang === 'en' ? 'Jhadimadi AI' : 'ঝাদিমাদি এআই'}
            </span>
            <span className="text-[9px] bg-emerald-500/40 text-emerald-100 font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
              {lang === 'en' ? 'Live' : 'অনলাইন'}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-100/90 font-medium leading-none mt-0.5">
            {lang === 'en' ? 'Sales Assistant' : 'সেলস অ্যাসিস্ট্যান্ট'}
          </span>
        </div>

        <MessageCircle className="w-4 h-4 text-emerald-200 ml-0.5 hidden sm:block group-hover:translate-x-0.5 transition-transform" />
      </button>
    </aside>
  );
};
