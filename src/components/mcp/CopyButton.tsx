import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function CopyButton({ text, className = '', size = 'md' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 gap-1.5'
    : 'px-3.5 py-2 gap-2';

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center rounded-lg border border-[#3A3A3A] bg-white/[0.06] 
        hover:bg-[rgba(90,143,94,0.15)] hover:border-[#C1A3FF] hover:text-[#B48FFF]
        transition-all duration-200 active:scale-95 ${sizeClasses} ${className}`}
    >
      {copied ? (
        <>
          <Check size={size === 'sm' ? 14 : 16} className="text-[#C1A3FF]" />
          <span className="font-mono font-medium text-[12px] text-[#C1A3FF]">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={size === 'sm' ? 14 : 16} className="text-[#9A9A9A]" />
          <span className="font-mono font-medium text-[12px] text-[#9A9A9A]">Copy</span>
        </>
      )}
    </button>
  );
}
