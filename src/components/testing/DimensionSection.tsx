import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import type { Dimension } from './data';

interface DimensionSectionProps {
  dimension: Dimension;
  index: number;
}

const staggerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export default function DimensionSection({ dimension, index }: DimensionSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const isEven = index % 2 === 0;
  const Icon = dimension.icon;

  const bgColor = isEven ? 'bg-[#F7F7FB]' : 'bg-white';
  const gridPattern = isEven
    ? "bg-[linear-gradient(to_right,rgba(163,201,165,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(163,201,165,0.15)_1px,transparent_1px)] bg-[size:40px_40px]"
    : '';

  return (
    <section
      ref={ref}
      id={dimension.id}
      className={`w-full ${bgColor} py-24 lg:py-28 relative`}
    >
      {/* Grid pattern background */}
      {gridPattern && (
        <div
          className={`absolute inset-0 ${gridPattern} pointer-events-none`}
          aria-hidden="true"
        />
      )}

      <div className="container-tf relative z-10">
        <motion.div
          variants={staggerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className={`grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center ${
            isEven ? '' : 'lg:flex-row-reverse'
          }`}
        >
          {/* Visual side */}
          <motion.div
            variants={itemVariants}
            className={`lg:col-span-5 ${isEven ? 'lg:order-1' : 'lg:order-2'}`}
          >
            <div className="bg-white rounded-xl border border-[#D9D9D3] p-8 lg:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-[#E8E5FF] flex items-center justify-center">
                  <Icon size={40} className="text-[#574a7d]" strokeWidth={1.5} />
                </div>
              </div>
              <div className="text-center">
                <p className="font-mono font-medium text-[13px] uppercase tracking-wider text-[#6B6B6B] mb-2">
                  {dimension.category}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {dimension.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="inline-block font-mono font-medium text-[12px] bg-[#E8E5FF] text-[#574a7d] px-3.5 py-1.5 rounded"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Content side */}
          <motion.div
            variants={itemVariants}
            className={`lg:col-span-7 ${isEven ? 'lg:order-2' : 'lg:order-1'}`}
          >
            {/* Step label */}
            <span className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d] mb-4 block">
              {dimension.num} // {dimension.category}
            </span>

            {/* Headline */}
            <h2 className="font-heading font-medium text-[42px] leading-[1.15] tracking-tight text-[#333333] mb-3">
              {dimension.fullName}
            </h2>

            {/* Tagline */}
            <p className="font-heading font-medium text-[22px] leading-[1.3] text-[#574a7d] mb-6">
              {dimension.tagline}
            </p>

            {/* Description */}
            <p className="text-[16px] leading-[1.6] text-[#6B6B6B] mb-8 max-w-[640px]">
              {dimension.description}
            </p>

            {/* Features list */}
            <div className="space-y-3 mb-8">
              <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#9A9A9A] mb-3">
                How AI Enhances It
              </p>
              {dimension.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check size={16} className="text-[#574a7d] mt-1 flex-shrink-0" />
                  <span className="text-[16px] leading-[1.6] text-[#333333]">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              to="/run-test"
              className="inline-flex items-center gap-2 text-[15px] font-medium text-[#574a7d] hover:gap-3 transition-all duration-200 group"
            >
              Learn more in a test run
              <ArrowRight
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
