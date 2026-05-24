import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StepIndicator from '@/components/testrunner/StepIndicator';
import ConnectStep from '@/components/testrunner/ConnectStep';
import ConfigureStep from '@/components/testrunner/ConfigureStep';
import ExecuteStep from '@/components/testrunner/ExecuteStep';
import ReportStep from '@/components/testrunner/ReportStep';
import { saveAnalysisResults } from '@/lib/analysisStore';

export default function TestRunner() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const handleConnectComplete = useCallback((results: any) => {
    setAnalysisResults(results);
    saveAnalysisResults(results); // Persist for Dashboard & PRD Generator
    setCompletedSteps([0, 1, 2]);
    setCurrentStep(3); // Skip to report
  }, []);

  const handleConfigureComplete = useCallback(() => {
    setCompletedSteps((prev) => [...new Set([...prev, 0, 1])]);
    setCurrentStep(2);
  }, []);

  const handleConfigureBack = useCallback(() => {
    setCurrentStep(0);
  }, []);

  const handleExecuteComplete = useCallback(() => {
    setCompletedSteps((prev) => [...new Set([...prev, 0, 1, 2])]);
    setCurrentStep(3);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setCompletedSteps([]);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F0]">
      {/* Subtle grid pattern background */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      <div className="relative z-10">
        {/* Top padding for breathing room */}
        <div className="pt-8 pb-4 px-4 sm:px-6 lg:px-8">
          {/* Page Title */}
          <div className="max-w-[1000px] mx-auto text-center mb-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[13px] uppercase tracking-[0.08em] text-[#5A8F5E] mb-4"
            >
              // Interactive Testing
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="font-heading text-[36px] sm:text-[42px] font-semibold text-[#1A1A1A] tracking-[-0.02em] leading-[1.15]"
            >
              Run Your{' '}
              <span className="text-[#5A8F5E]">First Test</span>{' '}
              in 60 Seconds
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[16px] sm:text-[18px] text-[#6B6B6B] font-body mt-4 max-w-[550px] mx-auto"
            >
              Connect any public Git repository. TestForge will discover your API, analyze every endpoint, and generate a complete test report — no configuration required.
            </motion.p>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex items-center justify-center gap-6 sm:gap-8 mt-6"
            >
              {[
                { icon: 'shield', text: 'No code changes required' },
                { icon: 'clock', text: 'Runs in under 5 minutes' },
                { icon: 'lock', text: 'Public repos only' },
              ].map((badge) => (
                <div key={badge.icon} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#E8F0E8] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5A8F5E]" />
                  </div>
                  <span className="text-[13px] text-[#6B6B6B]">{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Wizard Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="max-w-[1000px] mx-auto bg-white border border-[#D9D9D3] rounded-2xl p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
          >
            {/* Step Indicator */}
            <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="connect"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <ConnectStep onComplete={handleConnectComplete} />
                </motion.div>
              )}
              {currentStep === 1 && (
                <motion.div
                  key="configure"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <ConfigureStep onComplete={handleConfigureComplete} onBack={handleConfigureBack} />
                </motion.div>
              )}
              {currentStep === 2 && (
                <motion.div
                  key="execute"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <ExecuteStep onComplete={handleExecuteComplete} />
                </motion.div>
              )}
              {currentStep === 3 && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <ReportStep onRestart={handleRestart} results={analysisResults} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom spacing */}
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
