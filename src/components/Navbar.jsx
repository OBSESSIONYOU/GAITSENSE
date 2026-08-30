import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <nav className="relative w-full h-[80px] border-b border-[rgba(20,22,20,0.06)] bg-background flex items-center justify-center sticky top-0 z-[60]">
      <div className="max-w-page w-full px-6 lg:px-8 flex items-center justify-between h-full">
        {/* LOGO - 放大尺寸，增强品牌展示 */}
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
            <div className="w-3.5 h-3.5 border-[2px] border-white rounded-full"></div>
          </div>
          <span className="text-[22px] font-bold tracking-widest font-sans">
            <span className="text-brand">GAIT</span><span className="text-primary">SENSE</span>
          </span>
        </div>

        <button
          type="button"
          data-mobile-nav-toggle
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileNavOpen ? '关闭导航菜单' : '打开导航菜单'}
          onClick={() => setMobileNavOpen((open) => !open)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm border border-divider text-secondary hover:text-primary hover:border-brand transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {mobileNavOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        {/* LINKS - 调大字号，增加间距，加粗底部高亮条，提升大气感 */}
        <div className="hidden md:flex items-center h-full space-x-12 text-[16px] font-medium text-secondary tracking-wide">
          <NavLink to="/" end className={({ isActive }) => `h-full flex items-center border-b-[3px] transition-colors ${isActive ? 'border-brand text-brand font-bold' : 'border-transparent hover:text-primary'}`}>
            产品首页
          </NavLink>
          <NavLink to="/live" className={({ isActive }) => `h-full flex items-center border-b-[3px] transition-colors ${isActive ? 'border-brand text-brand font-bold' : 'border-transparent hover:text-primary'}`}>
            实时感知
          </NavLink>
          <NavLink to="/identities" className={({ isActive }) => `h-full flex items-center border-b-[3px] transition-colors ${isActive ? 'border-brand text-brand font-bold' : 'border-transparent hover:text-primary'}`}>
            人员管理
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => `h-full flex items-center border-b-[3px] transition-colors ${isActive ? 'border-brand text-brand font-bold' : 'border-transparent hover:text-primary'}`}>
            数据统计
          </NavLink>
        </div>

        {/* 占位符保持两端平衡，增加宽度匹配扩大的菜单 */}
        <div className="hidden md:block w-[140px]"></div>
      </div>

      {mobileNavOpen && (
        <div id="mobile-navigation" className="absolute left-0 right-0 top-full z-[60] border-b border-divider bg-background shadow-lg md:hidden">
          <div className="px-6 py-3">
            <NavLink to="/" end onClick={closeMobileNav} className={({ isActive }) => `block border-b border-divider py-3 text-[14px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-secondary hover:text-primary'}`}>
              产品首页
            </NavLink>
            <NavLink to="/live" onClick={closeMobileNav} className={({ isActive }) => `block border-b border-divider py-3 text-[14px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-secondary hover:text-primary'}`}>
              实时感知
            </NavLink>
            <NavLink to="/identities" onClick={closeMobileNav} className={({ isActive }) => `block border-b border-divider py-3 text-[14px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-secondary hover:text-primary'}`}>
              人员管理
            </NavLink>
            <NavLink to="/insights" onClick={closeMobileNav} className={({ isActive }) => `block py-3 text-[14px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-secondary hover:text-primary'}`}>
              数据统计
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
