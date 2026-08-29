import { NavLink, useLocation } from 'react-router-dom';
import { navItems } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function MobileNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 
      dark:bg-surface-300/90 bg-white/90 backdrop-blur-xl 
      dark:border-t dark:border-white/10 border-t border-gray-200
      px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-2">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]
                ${isActive
                  ? 'dark:text-accent text-accent-dark'
                  : 'dark:text-gray-500 text-gray-400'
                }`}
            >
              <div className={`relative transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                )}
              </div>
              <span className={`text-[10px] font-medium transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label.split(' ')[0]}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
