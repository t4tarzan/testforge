import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Github } from 'lucide-react'

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
  { label: 'Managed', path: '/managed' },
  { label: 'MCP Integration', path: '/mcp' },
  { label: 'In the Wild', path: '/in-the-wild' },
  { label: 'Pipeline', path: '/pipeline' },
  { label: 'The Integrator', path: '/integrator' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Pricing', path: '/pricing' },
]

const resourceLinks = [
  { label: 'Documentation', path: '/docs' },
  { label: 'Whitepaper', path: '/testforge-whitepaper.html', external: true },
  { label: 'Test Runner', path: '/run-test' },
  { label: 'PRD Generator', path: '/prd-generator' },
  { label: 'Testing Dimensions', path: '/testing-dimensions' },
]

const companyLinks = [
  { label: 'GitHub', path: 'https://github.com/t4tarzan/testforge', external: true },
  { label: 'MCP server', path: 'https://testforge-mcp.fly.dev', external: true },
  { label: 'Contact', path: 'https://github.com/t4tarzan/testforge/issues', external: true },
  { label: 'Changelog', path: '/changelog', external: false },
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
            <p className="text-[#9A9A9A] text-sm leading-relaxed mb-4">
              AI CODE? Run TestForge! 21-dimension analysis in 30 seconds.
            </p>
            <a href="https://www.producthunt.com/products/testforge?utm_source=badge&utm_medium=badge" target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-all mb-4">
              <span className="text-sm">🏆</span>
              <span className="text-xs text-white/80 font-medium">Featured on Product Hunt</span>
            </a>
            <div className="flex items-center gap-4">
              <a href="https://github.com/t4tarzan/testforge" target="_blank" rel="noopener noreferrer" aria-label="TestForge on GitHub" className="text-[#9A9A9A] hover:text-[#7a6fad] transition-colors duration-200">
                <Github size={20} />
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
                  {link.external ? (
                    <a
                      href={link.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.path}
                      className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                    >
                      {link.label}
                    </Link>
                  )}
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
                  {link.external ? (
                    <a
                      href={link.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.path}
                      className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-all duration-200 inline-block hover:translate-x-0.5"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#3A3A3A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#9A9A9A] text-sm">
            &copy; 2026 TestForge. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-colors">Privacy</Link>
            <Link to="/terms" className="text-[#9A9A9A] text-sm hover:text-[#7a6fad] transition-colors">Terms</Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#574a7d] animate-pulse" />
              <span className="text-[#9A9A9A] text-xs font-mono uppercase tracking-wider">All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
