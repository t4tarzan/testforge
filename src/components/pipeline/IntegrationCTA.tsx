import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function IntegrationCTA() {
  return (
    <section className="relative bg-[#5A8F5E] py-24 lg:py-32 px-6 sm:px-12 lg:px-16 overflow-hidden">
      {/* Decorative pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-[800px] mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-heading font-medium text-[32px] sm:text-[38px] lg:text-[42px] leading-[1.15] tracking-[-0.02em] text-white mb-6"
        >
          Ready to test without limits?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-body text-[18px] leading-[1.65] text-white/80 mb-10 max-w-[560px] mx-auto"
        >
          Connect your repository and run your first multi-dimensional test in under 60 seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button className="px-8 py-[14px] rounded-lg bg-white text-[#5A8F5E] font-body font-medium text-[16px] hover:bg-[#F5F5F0] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group">
            Start Testing Free
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <Link
            to="/integrator"
            className="px-8 py-[14px] rounded-lg border border-white text-white font-body font-medium text-[16px] hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
          >
            Explore The Integrator
            <ArrowUpRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
