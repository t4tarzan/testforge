import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export default function CodeBlock({ code, language = 'json', showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="bg-[#12101A] rounded-[10px] overflow-hidden my-4">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E1B2E]">
        <span className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A]">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md 
            hover:bg-white/5 transition-all duration-200 active:scale-95"
        >
          {copied ? (
            <>
              <Check size={14} className="text-[#574a7d]" />
              <span className="font-mono font-medium text-[11px] text-[#574a7d]">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} className="text-[#9A9A9A]" />
              <span className="font-mono font-medium text-[11px] text-[#9A9A9A]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-[13px] leading-[1.8] text-[#E8E8E3]">
          {showLineNumbers ? (
            <div className="flex">
              <div className="pr-4 mr-4 border-r border-[#1E1B2E] text-right min-w-[40px]">
                {lines.map((_, i) => (
                  <div key={i} className="text-[#3A3A3A] text-[12px] select-none">
                    {i + 1}
                  </div>
                ))}
              </div>
              <div>
                {lines.map((line, i) => (
                  <div key={i}>{line || ' '}</div>
                ))}
              </div>
            </div>
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
}
