import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, GitBranch, Zap, Shield } from 'lucide-react';

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setShow(false);
  };

  const steps = [
    {
      title: 'Welcome to TestForge!',
      description: 'Your code never leaves your machine. Drop any public repo URL and get a 21-dimension analysis in 30 seconds.',
      icon: Shield,
    },
    {
      title: 'Run Your First Test',
      description: 'Go to the Managed page, paste a GitHub repo URL, and get instant results across all 21 testing dimensions.',
      icon: GitBranch,
      action: { label: 'Go to Managed', path: '/#/managed' },
    },
    {
      title: 'Install MCP for IDE',
      description: 'Get real-time analysis in Cursor or VS Code with one command: npx @whitenoisenpm/testforge-mcp@latest',
      icon: Zap,
      action: { label: 'MCP Docs', path: '/#/mcp' },
    },
  ];

  const currentStep = steps[step];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full p-8"
          >
            <currentStep.icon size={40} className="text-[#574a7d] mb-4" />
            <h2 className="text-xl font-semibold text-[#12101A] mb-2">{currentStep.title}</h2>
            <p className="text-sm text-[#6B6B6B] mb-6">{currentStep.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-[#574a7d]' : 'bg-[#D9D9D3]'}`} />
                ))}
              </div>
              <div className="flex gap-2">
                {step < steps.length - 1 ? (
                  <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-[#574a7d] text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button onClick={dismiss} className="px-4 py-2 bg-[#574a7d] text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                    <Check size={14} /> Get Started
                  </button>
                )}
                <button onClick={dismiss} className="px-3 py-2 text-sm text-[#6B6B6B] hover:text-[#12101A]">Skip</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
