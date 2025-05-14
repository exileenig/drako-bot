import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faHome,
  faCog,
  faChevronDown,
  faExternalLinkAlt,
  faBars,
  faXmark,
  faChartLine,
  faCode,
  faTicket,
  faComments,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons"
import api from "../../lib/api/axios"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { socket } from "../../socket"
import { ProfileButton } from "../ui/profile-button"
import { auth } from "../../lib/auth/auth"

const spring = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 1,
}

const NavItemSkeleton = () => (
  <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center">
    <motion.div
      className="w-5 h-5 bg-gray-800/50 rounded-lg"
      animate={{
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.02, 1],
      }}
      transition={{
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    />
    <motion.div
      className="ml-3 w-20 sm:w-24 h-4 bg-gray-800/50 rounded-lg"
      animate={{
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.02, 1],
      }}
      transition={{
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
        delay: 0.2,
      }}
    />
  </div>
)

const defaultNavigationItems = [
  {
    name: "Overview",
    href: "/",
    icon: faHome,
    permission: "Login",
  },
  {
    name: "Support",
    href: "/tickets",
    icon: faTicket,
    permission: "Login",
  },
  {
    name: "Analytics",
    href: "/usage",
    icon: faChartLine,
    permission: "Usage",
  },
  {
    name: "Builder",
    href: "/embed-builder",
    icon: faCode,
    permission: "Embed",
  },
  {
    name: "Suggestions",
    href: "/suggestions",
    icon: faComments,
    permission: "Suggestions",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: faCog,
    permission: "Settings",
  },
]

function NavSection({
  title,
  items,
  renderNavItem,
  isOpen: defaultIsOpen = true,
  alwaysShow = false,
  isLoading = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultIsOpen)
  const shouldReduceMotion = useReducedMotion()

  if (!isLoading && !items?.length && !alwaysShow) {
    return null
  }

  const variants = {
    open: {
      height: "auto",
      opacity: 1,
      transition: {
        height: { duration: 0.3, ease: "easeOut" },
        opacity: { duration: 0.2, delay: 0.1 },
      },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: {
        height: { duration: 0.3, ease: "easeIn" },
        opacity: { duration: 0.2 },
      },
    },
  }

  return (
    <motion.div
      className="mt-6 first:mt-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center px-4 mb-2 group relative"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={spring}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="flex-1 flex items-center justify-between relative">
          <motion.span
            className="text-xs font-medium uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-gray-400 to-gray-300 group-hover:from-white group-hover:to-gray-300 transition-all duration-200"
            animate={{
              backgroundImage: isOpen 
                ? "linear-gradient(to right, rgb(255,255,255), rgb(209,213,219))"
                : "linear-gradient(to right, rgb(156,163,175), rgb(209,213,219))"
            }}
          >
            {title}
          </motion.span>
          <motion.div 
            animate={{ rotate: isOpen ? 0 : -90 }} 
            transition={shouldReduceMotion ? { duration: 0 } : spring}
            className="text-gray-200 group-hover:text-white"
          >
            <FontAwesomeIcon
              icon={faChevronDown}
              className="w-2.5 h-2.5 transition-transform duration-200"
            />
          </motion.div>
        </div>
      </motion.button>
      <motion.div variants={variants} initial="closed" animate={isOpen ? "open" : "closed"} className="overflow-hidden">
        <motion.ul
          className="space-y-[2px] px-2"
          variants={{
            open: {
              transition: { staggerChildren: 0.07, delayChildren: 0.2 },
            },
            closed: {
              transition: { staggerChildren: 0.05, staggerDirection: -1 },
            },
          }}
        >
          {isLoading ? (
            <>
              <NavItemSkeleton />
              <NavItemSkeleton />
              <NavItemSkeleton />
            </>
          ) : items && items.length > 0 ? (
            items.map(renderNavItem)
          ) : (
            <motion.li
              className="px-3 py-2 text-gray-500 text-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              No items available
            </motion.li>
          )}
        </motion.ul>
      </motion.div>
    </motion.div>
  )
}

export default function Sidebar({ navName = "", onClose, isMobileMenuOpen }) {
  const location = useLocation()
  const [customItems, setCustomItems] = useState([])
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024)
  const [categories, setCategories] = useState({
    navigation: "Menu",
    custom: "Custom Links",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isHeaderLoading, setIsHeaderLoading] = useState(true)
  const [permissions, setPermissions] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const loadPermissionsAndUser = async () => {
      try {
        const [configResponse, userResponse] = await Promise.all([
          api.get("/auth/config"),
          api.get("/auth/me")
        ]);

        setPermissions(configResponse.data.permissions.Dashboard);
        setUser(userResponse.data.user);
      } catch (error) {
        console.error("Failed to load permissions:", error);
      }
    };

    loadPermissionsAndUser();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      setIsHeaderLoading(true)
      try {
        const dashResponse = await api.get("/settings/dashboard")

        if (dashResponse.data && typeof dashResponse.data === "object") {
          const { customNavItems, categories } = dashResponse.data

          if (Array.isArray(customNavItems)) {
            setCustomItems(customNavItems)
          }

          if (categories) {
            setCategories((prevCategories) => ({
              ...prevCategories,
              ...categories,
            }))
          }
        } else {
          throw new Error("Invalid dashboard settings response")
        }
      } catch (e) {
        setCustomItems([])
        setCategories({
          navigation: "Menu",
          custom: "Custom Links",
        })
      } finally {
        setIsLoading(false)
        setIsHeaderLoading(false)
      }
    }

    loadSettings()
  }, [])

  useEffect(() => {
    const handleSettingsUpdate = (data) => {
      if (Array.isArray(data?.customNavItems)) {
        setCustomItems(data.customNavItems)
      }
      if (data?.categories) {
        setCategories((prevCategories) => ({
          ...prevCategories,
          ...data.categories,
        }))
      }
    }

    socket.on("settings:update", handleSettingsUpdate)
    return () => {
      socket.off("settings:update", handleSettingsUpdate)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 1024
      setIsMobile(newIsMobile)
      setIsSidebarOpen(!newIsMobile)
    }

    let resizeTimer
    const debouncedResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(handleResize, 100)
    }

    window.addEventListener("resize", debouncedResize)
    return () => {
      window.removeEventListener("resize", debouncedResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  const hasPermission = (requiredPermission) => {
    if (!permissions || !user || !user.roles) {
      return false;
    }
    
    if (!requiredPermission || (requiredPermission === "Login" && permissions.Login?.some(roleId => 
      user.roles.includes(roleId) || user.roles.some(role => role.id === roleId)
    ))) {
      return true;
    }
    
    const requiredRoles = permissions[requiredPermission] || [];
    
    const hasRole = requiredRoles.some(requiredRoleId => 
      user.roles.includes(requiredRoleId) ||
      user.roles.some(role => role.id === requiredRoleId)
    );
    
    return hasRole;
  };

  const renderNavItem = (item) => {
    if (!hasPermission(item.permission)) {
      return null;
    }

    const isActive = location.pathname === item.href
    const isExternal = item.href.startsWith("http")
    const emoji = item.emoji || (isExternal ? "🔗" : null)

    const sharedClasses = `px-3 sm:px-4 py-2.5 sm:py-3 flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative ${
      isActive
        ? "text-white bg-gradient-to-r from-gray-800/90 to-gray-800/50 shadow-lg shadow-black/10"
        : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/50"
    }`

    const content = (
      <div className="relative flex items-center w-full">
        {emoji ? (
          <span className="w-5 h-5 flex items-center justify-center text-lg">{emoji}</span>
        ) : (
          <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
        )}
        <span className="ml-3">{item.name}</span>
        {isExternal && (
          <FontAwesomeIcon
            icon={faExternalLinkAlt}
            className="w-3 h-3 ml-auto opacity-50"
          />
        )}
      </div>
    )

    return (
      <motion.li
        key={item.href}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {isExternal ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={sharedClasses}
          >
            {content}
          </a>
        ) : (
          <Link
            to={item.href}
            className={sharedClasses}
            onClick={() => {
              if (isMobile) {
                onClose?.()
              }
            }}
          >
            {content}
          </Link>
        )}
      </motion.li>
    )
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
    if (isMobile && !isSidebarOpen) {
      onClose?.()
    }
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Sidebar */}
        {(isSidebarOpen || !isMobile) && (
          <motion.aside
            initial={isMobile ? { x: "-100%", opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={spring}
            className="h-screen flex flex-col fixed lg:sticky top-0 left-0 w-[85vw] sm:w-[380px] lg:w-[300px] xl:w-[320px] z-40 bg-gray-900/95 backdrop-blur-xl border-r border-gray-800/50 shadow-2xl shadow-black/20"
          >
            {/* Header */}
            <div className="h-[70px] sm:h-[80px] lg:h-[90px] flex-none flex items-center justify-between px-5 sm:px-6 lg:px-8 border-b border-gray-800/50 relative">
              {isHeaderLoading ? (
                <motion.div
                  className="w-full flex items-center justify-center"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                >
                  <div className="h-8 w-32 rounded-lg bg-gray-800/50" />
                </motion.div>
              ) : (
                <div className="w-full flex items-center justify-center relative">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="relative"
                  >
                    <motion.span
                      className="font-bold text-xl sm:text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-purple-400 to-pink-300"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      {navName || "DrakoBot"}
                    </motion.span>
                    <motion.div
                      className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    />
                  </motion.div>
                  {isMobile && (
                    <button
                      onClick={toggleSidebar}
                      className="absolute -right-2 p-2.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/50 transition-all duration-200"
                    >
                      <FontAwesomeIcon icon={faXmark} className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 sm:py-5 lg:py-6 px-3 sm:px-4 lg:px-5">
              <div className="space-y-6 sm:space-y-7 lg:space-y-8">
                <NavSection
                  title={categories.navigation}
                  items={defaultNavigationItems}
                  renderNavItem={renderNavItem}
                  isLoading={isLoading}
                  alwaysShow={true}
                />

                {customItems && customItems.length > 0 && (
                  <NavSection
                    title={categories.custom}
                    items={customItems.map(item => ({
                      ...item,
                      emoji: item.emoji || "🔗"
                    }))}
                    renderNavItem={renderNavItem}
                    isLoading={isLoading}
                    alwaysShow={false}
                  />
                )}
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-800/50 bg-gray-900/50">
              <div className="p-3 sm:p-4 lg:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0 flex-1">
                    <ProfileButton 
                      className="!p-0 !bg-transparent !border-0 hover:!bg-transparent" 
                      minimal={true}
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <Link
                      to="/settings"
                      className="p-2 sm:p-2.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/50 transition-all duration-200"
                      onClick={() => {
                        if (onClose && window.innerWidth < 1024) {
                          onClose()
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faCog} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </Link>
                    <button
                      onClick={() => {
                        auth.logout();
                        if (onClose && window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className="p-2 sm:p-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800/50 transition-all duration-200"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Toggle Button */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div
            className="lg:hidden fixed top-4 left-4 z-50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring}
          >
            <motion.button
              onClick={toggleSidebar}
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg bg-gray-900/95 text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faBars} className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>
    </>
  )
}