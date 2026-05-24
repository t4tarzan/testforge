import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Github, Twitter, Linkedin, MessageCircle } from 'lucide-react'

const LogoIconWhite = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="3" stroke="#a39fd4" strokeWidth="2" fill="none" />
    <circle cx="24" cy="8" r="3" stroke="#a39fd4" strokeWidth="2" fill="none" />
    <circle cx="8" cy="24" r="3" stroke="#a39fd4" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="3" stroke="#a39fd4" strokeWidth="2" fill="none" />
    <line x1="11" y1="8" x2="21" y2="8" stroke="#a39fd4" strokeWidth="1.5" />
    <line x1="8" y1="11" x2="8" y2="21" stroke="#a39fd4" strokeWidth="1.5" />
    <line x1="11" y1="24" x2="21" y2="24" stroke="#a39fd4" strokeWidth="1.5" />
    <line x1="24" y1="11" x2="24" y2="21" stroke="#a39fd4" strokeWidth="1.5" />
    <line x1="10.1" y1="10.1" x2="21.9" y2="21.9" stroke="#a39fd4" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="2" fill="#7a6fad" />
  </svg>
)

const productLinks = [
  { label: 'Pipeline', path: '/pipeline' },
  { label: 'The Integrator', path: '/integrator' },
  { label: 'Testing Dimensions', path: '/testing-dimensions' },
  { label: 'PRD Generator', path: '/prd-generator' },
  { label: 'Dashboard', path: '/dashboard' },
]

const resourceLinks = [
  { label: 'Documentation', path: '#' },
  { label: 'API Reference', path: '#' },
  { label: 'Changelog', path: '#' },
  { label: 'Blog', path: '#' },
  { label: 'Community', path: '#' },
]

const companyLinks = [
  { label: 'About', path: '#' },
  { label: 'Careers', path: '#' },
  { label: 'Contact', path: '#' },
  { label: 'Privacy Policy', path: '#' },
  { label: 'Terms', path: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#12101A] text-white">
      <div className="container-tf py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <LogoIconWhite />
              <span className="font-heading font-semibold text-[18px] text-white tracking-tight">
                TestForge
              </span>
            </div>
            <p className="text-[#9A9A9A] text-sm leading-relaxed mb-6">
              AI-powered autonomous testing for the agentic era.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-[#9A9A9A] hover:text-[#7a6fad] transition-colors duration-200">
                <Github size={20} />
              </a>
              <a href="#" className="text-[#9A9A9A] hover:text-[#7a6fad] transition-colors duration-200">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-[#9A9A9A] hover:text-[#7a6fad] transition-colors duration-200">
                <Linkedin size={20} />
              </a>
              <a href="#" className="text-[#9A9A9A] hover:text-[#7a6fad] transition-colors duration-200">
                <MessageCircle size={20} />
              </a>
            </div>
          </motion.div>

          {/* Product Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            <h4 className="font-body font-medium text-[15px] text-white mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.path}
                    className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Resources Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.16 }}
          >
            <h4 className="font-body font-medium text-[15px] text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.path}
                    className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <h4 className="font-body font-medium text-[15px] text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.path}
                    className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#3A3A3A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#9A9A9A] text-sm">
            2026 TestForge. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#574a7d] animate-pulse" />
            <span className="text-[#9A9A9A] text-xs font-mono uppercase tracking-wider">All Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
