import { memo } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

interface Stat {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
}

const stats: Stat[] = [
  { value: 13, suffix: '', label: 'Testing Dimensions' },
  { value: 5, suffix: 'min', prefix: '<', label: 'Avg. Execution' },
  { value: 99.2, suffix: '%', label: 'Accuracy' },
  { value: 40, suffix: '%', label: 'Time Saved' },
];

const StatCard = memo(function StatCard({ stat, index }: { stat: Stat; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
      className="bg-white rounded-2xl p-8 text-center border border-[#D9D9D3] shadow-card"
    >
      <div className="font-heading font-bold text-[42px] sm:text-[48px] text-[#574a7d] leading-none tracking-tight">
        <CountUp
          end={stat.value}
          duration={2.5}
          decimals={stat.value % 1 !== 0 ? 1 : 0}
          prefix={stat.prefix || ''}
          suffix={stat.suffix}
          enableScrollSpy
          scrollSpyOnce
        />
      </div>
      <div className="font-mono font-medium text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] mt-3">
        {stat.label}
      </div>
    </motion.div>
  );
});

export default function StatsBar() {
  return (
    <section className="relative bg-[#F7F7FB] py-16 lg:py-20 px-6 sm:px-12 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
