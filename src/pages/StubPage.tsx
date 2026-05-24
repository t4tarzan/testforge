import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Hexagon } from 'lucide-react';

interface StubPageProps {
  title: string;
  description?: string;
}

export default function StubPage({ title, description }: StubPageProps) {
  return (
    <div className="min-h-[100dvh] bg-[#F5F5F0] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="text-center"
      >
        {/* TestForge Logo Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#F0EAFF] flex items-center justify-center">
          <Hexagon size={32} className="text-[#C1A3FF]" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="font-heading font-semibold text-[32px] text-[#1A1A1A] tracking-[-0.015em]">
          {title}
        </h1>

        {/* Description */}
        <p className="text-[16px] text-[#6B6B6B] font-body mt-3 max-w-[400px] mx-auto leading-[1.6]">
          {description || 'This page is under construction. Check back soon!'}
        </p>

        {/* Coming soon badge */}
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#F0EAFF] border border-[#C9B5FF] rounded-full">
          <div className="w-2 h-2 rounded-full bg-[#C1A3FF] animate-pulse" />
          <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#C1A3FF] font-medium">
            Coming Soon
          </span>
        </div>

        {/* Back to home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#C1A3FF] text-white rounded-lg font-body font-medium text-[15px] hover:bg-[#A07BDD] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
