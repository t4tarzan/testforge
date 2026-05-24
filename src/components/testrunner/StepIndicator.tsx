import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
}

const steps = ['Connect', 'Configure', 'Execute', 'Report'];

export default function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="mb-8">
      {/* Progress bar background */}
      <div className="relative mb-6">
        <div className="h-[3px] bg-[#ECEBF5] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#574a7d] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          />
        </div>
      </div>

      {/* Step circles and labels */}
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isActive = currentStep === index;
          return (
            <div key={step} className="flex flex-col items-center gap-2 flex-1">
              <motion.div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium
                  transition-colors duration-200
                  ${isActive || isCompleted
                    ? 'bg-[#574a7d] text-white'
                    : 'bg-[#F7F7FB] border-2 border-[#D9D9D3] text-[#9A9A9A]'
                  }
                `}
                animate={isActive ? { scale: [1, 1.08, 1] } : isCompleted ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
              >
                {isCompleted ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </motion.div>

              <motion.span
                className={`
                  font-mono text-[11px] uppercase tracking-[0.08em] font-medium hidden sm:block
                  ${isActive || isCompleted ? 'text-[#574a7d]' : 'text-[#9A9A9A]'}
                `}
                animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 1 }}
                initial={{ opacity: 0.7 }}
              >
                {step}
              </motion.span>
            </div>
          );
        })}
      </div>

      {/* Connecting lines (visual only) */}
      <div className="hidden lg:flex justify-between items-center mt-[-52px] mb-8 px-[18px] relative -z-10">
        {steps.slice(0, -1).map((_, index) => {
          const isCompleted = completedSteps.includes(index);
          return (
            <div
              key={index}
              className={`flex-1 h-[2px] mx-8 transition-colors duration-500 ${
                isCompleted ? 'bg-[#574a7d]' : 'bg-[#D9D9D3]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
