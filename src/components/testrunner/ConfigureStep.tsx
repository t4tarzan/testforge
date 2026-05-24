import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Target, Grid3X3, FlaskConical, Puzzle, Route, Gauge, Brain,
  Shield, Eye, Accessibility, CloudLightning, Dna, Check, ChevronDown, ChevronUp,
  Zap
} from 'lucide-react';

interface TestType {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  category: 'Functional' | 'Non-Functional' | 'Specialized';
  badge: string;
  badgeColor: string;
}

const TEST_TYPES: TestType[] = [
  { id: 'scope', name: 'Scope Test', icon: Target, description: 'Endpoint discovery', category: 'Functional', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'vision', name: 'Vision/Goal', icon: Eye, description: 'Business goal validation', category: 'Functional', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'feature', name: 'Feature Matrix', icon: Grid3X3, description: 'Feature coverage mapping', category: 'Functional', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'unit', name: 'Unit Test', icon: FlaskConical, description: 'Individual function tests', category: 'Functional', badge: 'WARN', badgeColor: 'bg-[rgba(232,168,56,0.1)] text-[#E8A838]' },
  { id: 'integration', name: 'Integration', icon: Puzzle, description: 'Service interaction tests', category: 'Functional', badge: 'WARN', badgeColor: 'bg-[rgba(232,168,56,0.1)] text-[#E8A838]' },
  { id: 'e2e', name: 'E2E Test', icon: Route, description: 'Full user flow tests', category: 'Functional', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'load', name: 'Load & Scale', icon: Gauge, description: 'Performance under load', category: 'Non-Functional', badge: 'FAIL', badgeColor: 'bg-[rgba(212,82,74,0.1)] text-[#D4524A]' },
  { id: 'predictive', name: 'Predictive', icon: Brain, description: 'ML-based risk detection', category: 'Non-Functional', badge: 'HIGH', badgeColor: 'bg-[rgba(232,125,58,0.1)] text-[#E87D3A]' },
  { id: 'security', name: 'Security', icon: Shield, description: 'Vulnerability scanning', category: 'Non-Functional', badge: 'CRIT', badgeColor: 'bg-[rgba(212,82,74,0.1)] text-[#D4524A]' },
  { id: 'visual', name: 'Visual Regression', icon: Eye, description: 'UI snapshot comparison', category: 'Non-Functional', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'accessibility', name: 'Accessibility', icon: Accessibility, description: 'WCAG compliance', category: 'Specialized', badge: 'WARN', badgeColor: 'bg-[rgba(232,168,56,0.1)] text-[#E8A838]' },
  { id: 'chaos', name: 'Chaos Eng.', icon: CloudLightning, description: 'Fault injection recovery', category: 'Specialized', badge: 'PASS', badgeColor: 'bg-[#F0EAFF] text-[#C1A3FF]' },
  { id: 'mutation', name: 'Mutation Test', icon: Dna, description: 'Test suite hardening', category: 'Specialized', badge: 'FAIL', badgeColor: 'bg-[rgba(212,82,74,0.1)] text-[#D4524A]' },
];

interface ConfigureStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export default function ConfigureStep({ onComplete, onBack }: ConfigureStepProps) {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set(TEST_TYPES.map((t) => t.id)));
  const [testDepth, setTestDepth] = useState<'deep' | 'shallow'>('deep');
  const [coverageTarget, setCoverageTarget] = useState(2); // 0=basic, 1=standard, 2=comprehensive
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeoutVal, setTimeoutVal] = useState(30);
  const [concurrent, setConcurrent] = useState(4);
  const [failFast, setFailFast] = useState(false);

  const toggleTest = (id: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedTests(new Set(TEST_TYPES.map((t) => t.id)));
  const deselectAll = () => setSelectedTests(new Set());

  // Calculate estimated time
  const estimatedMinutes = useMemo(() => {
    let base = 0;
    if (selectedTests.has('scope')) base += 0.5;
    if (selectedTests.has('vision')) base += 1;
    if (selectedTests.has('feature')) base += 1.5;
    if (selectedTests.has('unit')) base += 4;
    if (selectedTests.has('integration')) base += 4;
    if (selectedTests.has('e2e')) base += 6;
    if (selectedTests.has('load')) base += 8;
    if (selectedTests.has('predictive')) base += 2;
    if (selectedTests.has('security')) base += 4;
    if (selectedTests.has('visual')) base += 2;
    if (selectedTests.has('accessibility')) base += 2;
    if (selectedTests.has('chaos')) base += 6;
    if (selectedTests.has('mutation')) base += 7;

    // Adjust for depth
    const depthMultiplier = testDepth === 'deep' ? 1.3 : 0.7;
    // Adjust for coverage
    const coverageMultiplier = [0.7, 1.0, 1.4][coverageTarget];

    const total = base * depthMultiplier * coverageMultiplier;
    return Math.max(0.5, total).toFixed(1);
  }, [selectedTests, testDepth, coverageTarget]);

  const categories = ['Functional', 'Non-Functional', 'Specialized'] as const;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      {/* Title */}
      <div className="mb-6">
        <h2 className="font-heading text-[28px] font-medium text-[#1A1A1A] tracking-[-0.01em]">
          Configure Your Test Suite
        </h2>
        <p className="text-[16px] text-[#6B6B6B] font-body mt-2">
          Select which tests to run and set your coverage depth. All 13 dimensions are available.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Test Types */}
        <div className="flex-1 lg:flex-[3]">
          <div className="flex items-center justify-between mb-4">
            <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium">
              Select Test Types
            </label>
            <div className="flex gap-3">
              <button onClick={selectAll} className="font-mono text-[12px] text-[#C1A3FF] font-medium hover:underline">
                Select All
              </button>
              <button onClick={deselectAll} className="font-mono text-[12px] text-[#C1A3FF] font-medium hover:underline">
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9A9A9A] mb-2">
                  {category}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEST_TYPES.filter((t) => t.category === category).map((test, i) => {
                    const isSelected = selectedTests.has(test.id);
                    return (
                      <motion.button
                        key={test.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.5 }}
                        onClick={() => toggleTest(test.id)}
                        className={`
                          flex items-center gap-3 p-3 rounded-[10px] border text-left transition-all duration-200
                          ${isSelected
                            ? 'border-[#C1A3FF] bg-[rgba(90,143,94,0.04)] shadow-[0_0_0_3px_rgba(90,143,94,0.08)]'
                            : 'border-[#D9D9D3] bg-white hover:border-[#C9B5FF] hover:bg-[#F0EAFF]'
                          }
                        `}
                      >
                        {/* Checkbox */}
                        <motion.div
                          animate={isSelected ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                          className={`
                            w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-all duration-200
                            ${isSelected ? 'bg-[#C1A3FF] border-[#C1A3FF]' : 'border-2 border-[#D9D9D3]'}
                          `}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                        </motion.div>

                        {/* Icon */}
                        <test.icon size={18} className="text-[#C1A3FF] flex-shrink-0" />

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-medium text-[#333333]">{test.name}</div>
                          <div className="text-[12px] text-[#9A9A9A] truncate">{test.description}</div>
                        </div>

                        {/* Badge */}
                        <span className={`font-mono text-[10px] uppercase font-medium px-2 py-0.5 rounded flex-shrink-0 ${test.badgeColor}`}>
                          {test.badge}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Scope Config */}
        <div className="lg:flex-[2] space-y-6">
          {/* Test Depth */}
          <div>
            <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-3">
              Coverage Depth
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setTestDepth('shallow')}
                className={`w-full p-4 rounded-[10px] border-2 text-left transition-all duration-200 relative ${
                  testDepth === 'shallow'
                    ? 'border-[#C1A3FF] bg-[#F5F5F0]'
                    : 'border-[#D9D9D3] bg-[#F5F5F0] hover:border-[#C9B5FF]'
                }`}
              >
                {testDepth === 'shallow' && (
                  <Check size={16} className="absolute top-3 right-3 text-[#C1A3FF]" />
                )}
                <div className="text-[14px] font-medium text-[#333333]">Shallow Scan</div>
                <div className="text-[12px] text-[#6B6B6B] mt-0.5">
                  Fast — covers primary endpoints (~2 min)
                </div>
              </button>

              <button
                onClick={() => setTestDepth('deep')}
                className={`w-full p-4 rounded-[10px] border-2 text-left transition-all duration-200 relative ${
                  testDepth === 'deep'
                    ? 'border-[#C1A3FF] bg-[#F5F5F0]'
                    : 'border-[#D9D9D3] bg-[#F5F5F0] hover:border-[#C9B5FF]'
                }`}
              >
                {testDepth === 'deep' && (
                  <Check size={16} className="absolute top-3 right-3 text-[#C1A3FF]" />
                )}
                <div className="text-[14px] font-medium text-[#333333]">Deep Analysis</div>
                <div className="text-[12px] text-[#6B6B6B] mt-0.5">
                  Thorough — full coverage including edge cases (~5 min)
                </div>
              </button>
            </div>
          </div>

          {/* Coverage Slider */}
          <div>
            <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-3">
              Test Coverage
            </label>
            <div className="relative">
              <input
                type="range"
                min={0}
                max={2}
                step={1}
                value={coverageTarget}
                onChange={(e) => setCoverageTarget(Number(e.target.value))}
                className="w-full h-[6px] rounded-full appearance-none cursor-pointer accent-[#C1A3FF]"
                style={{
                  background: `linear-gradient(to right, #C1A3FF 0%, #C1A3FF ${(coverageTarget / 2) * 100}%, #EBEBE5 ${(coverageTarget / 2) * 100}%, #EBEBE5 100%)`
                }}
              />
              <div className="flex justify-between mt-2">
                <span className={`text-[12px] ${coverageTarget === 0 ? 'text-[#C1A3FF] font-medium' : 'text-[#9A9A9A]'}`}>Basic</span>
                <span className={`text-[12px] ${coverageTarget === 1 ? 'text-[#C1A3FF] font-medium' : 'text-[#9A9A9A]'}`}>Standard</span>
                <span className={`text-[12px] ${coverageTarget === 2 ? 'text-[#C1A3FF] font-medium' : 'text-[#9A9A9A]'}`}>Comprehensive</span>
              </div>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[#C1A3FF] font-medium hover:underline mb-3"
            >
              Advanced Options
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 bg-[#F5F5F0] rounded-lg p-4"
              >
                <div>
                  <label className="font-mono text-[11px] uppercase text-[#6B6B6B] block mb-1">
                    Timeout per test (seconds)
                  </label>
                  <input
                    type="number"
                    value={timeoutVal}
                    onChange={(e) => setTimeoutVal(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-white border border-[#D9D9D3] rounded-md font-mono text-[13px] focus:outline-none focus:border-[#C1A3FF]"
                  />
                </div>
                <div>
                  <label className="font-mono text-[11px] uppercase text-[#6B6B6B] block mb-1">
                    Concurrent tests
                  </label>
                  <input
                    type="number"
                    value={concurrent}
                    onChange={(e) => setConcurrent(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-white border border-[#D9D9D3] rounded-md font-mono text-[13px] focus:outline-none focus:border-[#C1A3FF]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[11px] uppercase text-[#6B6B6B]">
                    Fail fast
                  </label>
                  <button
                    onClick={() => setFailFast(!failFast)}
                    className={`w-10 h-5 rounded-full transition-colors duration-200 ${failFast ? 'bg-[#C1A3FF]' : 'bg-[#D9D9D3]'}`}
                  >
                    <motion.div
                      animate={{ x: failFast ? 20 : 2 }}
                      transition={{ duration: 0.2 }}
                      className="w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Estimated Time */}
          <div className="bg-[#F0EAFF] rounded-xl p-5 text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-1">
              Estimated Run Time
            </div>
            <div className="font-heading text-[32px] font-semibold text-[#C1A3FF]">
              ~{estimatedMinutes}
            </div>
            <div className="text-[14px] text-[#6B6B6B]">minutes</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-[#D9D9D3]">
        <button
          onClick={onBack}
          className="px-7 py-3.5 border border-[#D9D9D3] text-[#333333] rounded-lg font-body font-medium text-[15px] hover:bg-[#F0EAFF] hover:border-[#C9B5FF] transition-all"
        >
          &larr; Back
        </button>
        <motion.button
          onClick={onComplete}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-8 py-3.5 bg-[#C1A3FF] text-white rounded-lg font-body font-medium text-[16px] flex items-center gap-2 hover:bg-[#A07BDD] transition-colors"
        >
          <Zap size={16} />
          Run Tests &rarr;
        </motion.button>
      </div>
    </motion.div>
  );
}
