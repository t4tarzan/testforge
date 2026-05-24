import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, LogOut, User, CreditCard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const navLinks = [
  { label: 'Pipeline', path: '/pipeline' },
  { label: 'Integrator', path: '/integrator' },
  { label: 'Testing', path: '/testing-dimensions' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Pricing', path: '/pricing' },
]

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="24" cy="8" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="8" cy="24" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <line x1="11" y1="8" x2="21" y2="8" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="8" y1="11" x2="8" y2="21" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="11" y1="24" x2="21" y2="24" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="24" y1="11" x2="24" y2="21" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="10.1" y1="10.1" x2="21.9" y2="21.9" stroke="#574a7d" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="2" fill="#574a7d" />
  </svg>
)

// ── User Avatar Dropdown ───────────────────────────────────────────────────
function UserDropdown() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#574a7d] to-[#7a6fad] flex items-center justify-center text-white text-[13px] font-semibold">
          {user.avatar}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#D9D9D3] rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.1)] overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#D9D9D3]">
              <p className="text-[14px] text-[#12101A] font-medium font-body truncate">{user.name}</p>
              <p className="text-[12px] text-[#9A9A9A] font-body truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#333333] font-body hover:bg-[#F7F7FB] transition-colors"
              >
                <User size={16} /> Account
              </Link>
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#333333] font-body hover:bg-[#F7F7FB] transition-colors"
              >
                <CreditCard size={16} /> Billing
              </Link>
            </div>
            <div className="border-t border-[#D9D9D3] py-1">
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#D4524A] font-body hover:bg-[#F7F7FB] transition-colors"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN NAVBAR
// ═══════════════════════════════════════════════════════════════════════════
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <motion.nav
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className={`fixed top-0 left-0 right-0 z-50 h-[72px] flex items-center transition-all duration-300 ${
          scrolled
            ? 'bg-[#F7F7FB]/80 backdrop-blur-[12px] border-b border-[#D9D9D3]'
            : 'bg-transparent'
        }`}
      >
        <div className="container-tf w-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <LogoIcon />
            <span className="font-heading font-semibold text-[18px] text-[#12101A] tracking-tight">
              TestForge
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link, i) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <Link
                  to={link.path}
                  className="font-body font-medium text-[15px] text-[#333333] hover:text-[#574a7d] transition-colors duration-200 relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1.5px] bg-[#574a7d] transition-all duration-200 group-hover:w-full" />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <UserDropdown />
              </motion.div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <Link
                    to="/auth"
                    className="px-6 py-[14px] rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-[15px] hover:bg-[#E8E5FF] hover:border-[#a39fd4] transition-all duration-200"
                  >
                    Sign In
                  </Link>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                >
                  <Link
                    to="/auth?tab=signup"
                    className="px-6 py-[14px] rounded-lg bg-[#574a7d] text-white font-body font-medium text-[15px] hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group"
                  >
                    Get Started
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-[#333333]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-[#F7F7FB] flex flex-col items-center justify-center gap-8 lg:hidden"
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <Link
                  to={link.path}
                  className="font-heading font-medium text-2xl text-[#333333] hover:text-[#574a7d] transition-colors duration-200"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex flex-col items-center gap-4 mt-4"
            >
              {isAuthenticated ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#574a7d] text-white font-body font-medium text-base w-48 justify-center"
                  >
                    <User size={18} /> Account
                  </Link>
                  <button
                    onClick={() => { /* logout handled by useAuth */ }}
                    className="px-8 py-3 rounded-lg border border-[#D9D9D3] text-[#D4524A] font-body font-medium text-base w-48"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    onClick={() => setMobileOpen(false)}
                    className="px-8 py-3 rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-base w-48 text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setMobileOpen(false)}
                    className="px-8 py-3 rounded-lg bg-[#574a7d] text-white font-body font-medium text-base w-48 text-center"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
