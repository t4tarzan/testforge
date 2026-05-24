import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { comparisonData } from './data';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function ComparisonTable() {
  return (
    <section className="w-full bg-[#12101A] py-24 lg:py-32">
      <div className="container-tf">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-center mb-16"
        >
          <h2 className="font-heading font-semibold text-[42px] leading-[1.15] tracking-tight text-white">
            All <span className="text-[#574a7d]">thirteen</span>. Always running.
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-[1200px] mx-auto overflow-x-auto"
        >
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[#3A3A3A]">
                <th className="text-left py-4 px-4 font-mono font-medium text-[13px] uppercase tracking-wider text-[#9A9A9A]">
                  Dimension
                </th>
                <th className="text-center py-4 px-4 font-mono font-medium text-[13px] uppercase tracking-wider text-[#574a7d]">
                  TestForge
                </th>
                <th className="text-center py-4 px-4 font-mono font-medium text-[13px] uppercase tracking-wider text-[#9A9A9A]">
                  TestSprite
                </th>
                <th className="text-center py-4 px-4 font-mono font-medium text-[13px] uppercase tracking-wider text-[#9A9A9A]">
                  Traditional QA
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row) => (
                <motion.tr
                  key={row.dimension}
                  variants={rowVariants}
                  className="border-b border-[#1E1B2E] hover:bg-[#1E1B2E]/50 transition-colors duration-150"
                >
                  <td className="py-3.5 px-4 text-[15px] text-white font-medium">
                    {row.dimension}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 15,
                        delay: 0.1,
                      }}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#574a7d]/20"
                    >
                      <Check size={14} className="text-[#574a7d]" />
                    </motion.div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {row.testsprite ? (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#574a7d]/20">
                        <Check size={14} className="text-[#574a7d]" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#D4524A]/10">
                        <X size={14} className="text-[#D4524A]" />
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {row.traditional ? (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#574a7d]/20">
                        <Check size={14} className="text-[#574a7d]" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#D4524A]/10">
                        <X size={14} className="text-[#D4524A]" />
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
