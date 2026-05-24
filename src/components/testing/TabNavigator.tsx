import { useEffect, useRef, useState } from 'react';
import { dimensions } from './data';

interface TabNavigatorProps {
  activeTab: string;
  onTabClick: (id: string) => void;
}

export default function TabNavigator({ activeTab, onTabClick }: TabNavigatorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && activeTab) {
      const activeButton = scrollContainerRef.current.querySelector(`[data-tab="${activeTab}"]`);
      if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  return (
    <div
      className={`w-full bg-white border-b border-[#D9D9D3] z-40 transition-shadow duration-300 ${
        isSticky ? 'shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : ''
      }`}
      style={{ position: 'sticky', top: '72px' }}
    >
      <div
        ref={scrollContainerRef}
        className="container-tf flex items-center gap-1 overflow-x-auto scrollbar-hide py-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {dimensions.map((dim) => {
          const Icon = dim.icon;
          const isActive = activeTab === dim.id;
          return (
            <button
              key={dim.id}
              data-tab={dim.id}
              onClick={() => onTabClick(dim.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 whitespace-nowrap font-medium text-[13px] transition-all duration-200 border-b-2 ${
                isActive
                  ? 'text-[#C1A3FF] border-[#C1A3FF]'
                  : 'text-[#6B6B6B] border-transparent hover:text-[#C1A3FF] hover:border-[#C9B5FF]'
              }`}
            >
              <Icon size={15} />
              <span>{dim.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
