import { useState, type FormEvent } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';

type State = 'idle' | 'loading' | 'done' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function NewsletterSignup({ source = 'in-the-wild' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setState('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setState('loading');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong.');
      }
      setState('done');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="bg-[#12101A] rounded-2xl p-8 lg:p-10 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(to right, #574a7d 1px, transparent 1px),
                            linear-gradient(to bottom, #574a7d 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative z-10 max-w-[640px] mx-auto text-center">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#574a7d]/20 border border-[#574a7d]/40 mb-4">
          <Mail size={20} className="text-[#a99bff]" />
        </div>
        <h2 className="font-heading font-semibold text-[24px] text-white mb-2">
          Findings in your inbox
        </h2>
        <p className="text-[#a99bff]/70 text-[15px] leading-relaxed mb-6">
          A periodic digest: a random bag of public repos we run through TestForge, with the
          real findings and the analyzer fixes they trigger. No spam, unsubscribe anytime.
        </p>

        {state === 'done' ? (
          <div className="inline-flex items-center gap-2 bg-[#0d9488]/15 border border-[#0d9488]/40 text-[#5eead4] rounded-lg px-5 py-3 font-body text-[14px]">
            <Check size={16} /> You’re on the list. Watch your inbox.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto">
            <input
              type="email"
              aria-label="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
              placeholder="you@company.com"
              disabled={state === 'loading'}
              className="flex-1 h-11 px-4 bg-white/5 border border-white/15 rounded-lg font-body text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#574a7d] focus:ring-[3px] focus:ring-[#574a7d]/20 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="h-11 px-6 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] hover:bg-[#6a5c93] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 shrink-0"
            >
              {state === 'loading' ? <><Loader2 size={16} className="animate-spin" /> Joining…</> : 'Subscribe'}
            </button>
          </form>
        )}

        {state === 'error' && (
          <p className="mt-3 text-[13px] text-[#fca5a5] font-body">{message}</p>
        )}
      </div>
    </div>
  );
}
