import { memo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react';

const DemoVideo = memo(function DemoVideo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPoster, setShowPoster] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
        setShowPoster(false);
      }
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <section className="relative bg-[#1A1A1A] py-24 lg:py-32 px-6 sm:px-12 lg:px-16 overflow-hidden">
      <div className="max-w-[1000px] mx-auto">
        {/* Label */}
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#7AAF7E] mb-4 block text-center"
        >
          // SEE IT IN ACTION
        </motion.span>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-heading font-medium text-[32px] sm:text-[38px] lg:text-[42px] leading-[1.15] tracking-[-0.02em] text-white text-center mb-12"
        >
          Watch the full pipeline execute in real-time.
        </motion.h2>

        {/* Video Player */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="relative rounded-2xl overflow-hidden bg-[#2A2A2A] border border-[#3A3A3A] group"
        >
          <div className="aspect-video relative">
            {/* Poster / Fallback Image */}
            {showPoster && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'url(/hero-pipeline-abstract.jpg)' }}
              >
                <div className="absolute inset-0 bg-[#1A1A1A]/50" />
              </div>
            )}

            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src="/pipeline-demo.mp4"
              poster="/hero-pipeline-abstract.jpg"
              muted={isMuted}
              playsInline
              loop
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />

            {/* Play button overlay */}
            {!isPlaying && (
              <motion.button
                onClick={handlePlay}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 flex items-center justify-center z-10"
              >
                <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-[#5A8F5E] flex items-center justify-center shadow-lg hover:bg-[#4A7A4E] hover:scale-110 transition-all duration-200">
                  <Play size={32} className="text-white ml-1" fill="white" />
                </div>
              </motion.button>
            )}

            {/* Custom controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlay}
                    className="text-white hover:text-[#5A8F5E] transition-colors duration-200"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-white hover:text-[#5A8F5E] transition-colors duration-200"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>
                <button
                  onClick={handleFullscreen}
                  className="text-white hover:text-[#5A8F5E] transition-colors duration-200"
                >
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="font-body text-[16px] leading-[1.6] text-[#9A9A9A] text-center mt-8 max-w-[640px] mx-auto"
        >
          From code push to production-ready — see how TestForge validates every dimension in under 3 minutes.
        </motion.p>
      </div>
    </section>
  );
});

export default DemoVideo;
