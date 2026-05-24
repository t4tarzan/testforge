import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  AlertTriangle,
  Shield,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: FeatureCard[] = [
  {
    icon: <Zap size={48} strokeWidth={1.5} />,
    title: 'Parallel Execution Engine',
    description:
      'All 21 dimensions run simultaneously across distributed agents. No sequential bottlenecks. Results aggregate in real-time.',
  },
  {
    icon: <AlertTriangle size={48} strokeWidth={1.5} />,
    title: 'Failure Root Cause Analysis',
    description:
      'When tests fail, our AI traces the failure back to its origin — identifying the exact commit, dependency change, or architectural decision that caused it.',
  },
  {
    icon: <Shield size={48} strokeWidth={1.5} />,
    title: 'Tests That Get Harder, Not Easier',
    description:
      'TestForge never relaxes test criteria to force a pass. Instead, it learns from failures and generates harder edge cases — ensuring real production resilience.',
  },
  {
    icon: <RefreshCw size={48} strokeWidth={1.5} />,
    title: 'Live Feedback to Your Coding Agent',
    description:
      'Test results feed directly back into Cursor, Claude Code, or any AI coding agent. Fix failures before they become production incidents.',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

const FeatureCard = memo(function FeatureCard({
  feature,
  index,
}: {
  feature: FeatureCard;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white border border-[#D9D9D3] rounded-xl p-8 lg:p-10 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      <motion.div
        animate={{ rotate: hovered ? 5 : 0 }}
        transition={{ duration: 0.3 }}
        className="text-[#574a7d] mb-6"
      >
        {feature.icon}
      </motion.div>

      <h3 className="font-heading font-medium text-[22px] leading-[1.3] tracking-[-0.005em] text-[#333333] mb-3">
        {feature.title}
      </h3>

      <p className="font-body text-[16px] leading-[1.6] text-[#6B6B6B]">
        {feature.description}
      </p>

      <div className="flex items-center gap-1 mt-6 text-[#574a7d] font-body font-medium text-[14px] group-hover:gap-2 transition-all duration-200">
        Learn more
        <ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </motion.div>
  );
});

export default function PipelineFeatures() {
  return (
    <section className="relative bg-[#ECEBF5] py-24 lg:py-32 px-6 sm:px-12 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Label */}
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d] mb-4 block"
        >
          // PIPELINE FEATURES
        </motion.span>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-heading font-semibold text-[36px] sm:text-[42px] lg:text-[52px] leading-[1.1] tracking-[-0.025em] text-[#333333] mb-16"
        >
          <span className="text-[#574a7d]">Intelligence</span> at every stage.
        </motion.h2>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
