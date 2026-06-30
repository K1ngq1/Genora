"use client";

import Link from "next/link";
import { useState } from "react";
import { GenoraMark, Icon } from "@/features/home/home-icons";

type HomeSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function HomeSidebar({ collapsed, onToggleCollapsed }: HomeSidebarProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <aside className={`home-sidebar ${collapsed ? "collapsed" : ""}`}>
      <Link className="home-sidebar-logo logo-button" href="/" aria-label="Genora" title="Genora" data-label="Genora">
        <GenoraMark />
        <span>Genora</span>
      </Link>
      <nav aria-label="主导航">
        <Link className="logo-button active" href="/" title="首页" data-label="首页"><Icon name="home" /><span>首页</span></Link>
        <Link className="logo-button" href="/projects" title="工作空间" data-label="工作空间"><Icon name="nodes" /><span>工作空间</span></Link>
      </nav>
      <div className="home-sidebar-bottom">
        <div className={`home-user-anchor ${accountOpen ? "open" : ""}`}>
          <button className="logo-button home-user-button" type="button" title="登录" data-label="登录" onClick={() => setAccountOpen((current) => !current)}>
            <Icon name="user" />
            <span>登录</span>
          </button>
          {accountOpen && (
            <div className="home-user-popover">
              <header className="home-user-card-head">
                <span className="home-user-avatar"><Icon name="user" /></span>
                <span>
                  <b>游客账户</b>
                  <small>登录后同步创作记录</small>
                </span>
              </header>
              <div className="home-user-plan"><span>额度</span><b>-- 积分</b></div>
              <div className="home-user-plan"><span>计划</span><b>Free</b></div>
              <button className="home-user-primary" type="button" onClick={() => setAccountOpen(false)}><Icon name="user" />登录 / 注册</button>
              <button className="home-user-secondary" type="button" onClick={() => setAccountOpen(false)}><Icon name="logout" />退出登录</button>
            </div>
          )}
        </div>
        <button className="home-collapse" type="button" onClick={onToggleCollapsed} title={collapsed ? "展开" : "收起"} data-label={collapsed ? "展开" : "收起"}>
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
          <span>{collapsed ? "展开" : "收起"}</span>
        </button>
      </div>
    </aside>
  );
}
