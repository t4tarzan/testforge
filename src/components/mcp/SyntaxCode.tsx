import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SyntaxCodeProps {
  code: string;
  language?: string;
}

// Simple syntax highlighter for JSON/config code
function highlightSyntax(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(\/\/.*$)/gm, '<span class="text-[#5A5A5A]">$1</span>')
    .replace(/(#.*$)/gm, '<span class="text-[#5A5A5A]">$1</span>')
    // Strings (both double and single quoted)
    .replace(/"([^"]*)":/g, '<span class="text-[#7a6fad]">"$1"</span>:')
    .replace(/"([^"]*)"/g, '<span class="text-[#C9A96E]">"$1"</span>')
    .replace(/'([^']*)'/g, '<span class="text-[#C9A96E]">\'$1\'</span>')
    // Keywords (true, false, null)
    .replace(/\b(true|false|null)\b/g, '<span class="text-[#D4A0A0]">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="text-[#D4A0A0]">$1</span>');
}

export default function SyntaxCode({ code, language = 'json' }: SyntaxCodeProps) {
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

  return (
    <div className="bg-[#12101A] rounded-[10px] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E1B2E]">
        <span className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A]">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/5 transition-all duration-200 active:scale-95"
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
      <div className="p-4 overflow-x-auto">
        <pre
          className="font-mono text-[12px] leading-[1.8] text-white"
          dangerouslySetInnerHTML={{ __html: highlightSyntax(code) }}
        />
      </div>
    </div>
  );
}
