"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { GenoraMark, Icon } from "@/features/home/home-icons";
import type { HomeChatSession } from "@/features/home/home-types";
import { useAuth } from "@/features/auth/auth-provider";

type HomeSidebarProps = {
  collapsed: boolean;
  sessions: HomeChatSession[];
  activeSessionId?: string;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
};

export function HomeSidebar({ collapsed, sessions, activeSessionId, onToggleCollapsed, onNewChat, onSelectSession }: HomeSidebarProps) {
  const { user, isAuthed, openAuthDialog, requireAuth, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleSessions = sessions.slice(0, 12);
  const query = searchQuery.trim().toLowerCase();
  const searchResults = query
    ? sessions.filter((session) => {
      const prompts = session.messages.map((message) => message.role === "user" ? message.content : message.task.prompt).join(" ");
      return `${session.title} ${prompts}`.toLowerCase().includes(query);
    }).slice(0, 8)
    : visibleSessions.slice(0, 6);
  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setSearchOpen(false);
  };
  const handleUserClick = () => {
    if (isAuthed) setAccountOpen((current) => !current);
    else openAuthDialog("account");
  };
  const handleWorkspace = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!requireAuth("workspace")) event.preventDefault();
  };

  return (
    <aside className={`home-sidebar ${collapsed ? "collapsed" : ""}`}>
      <button className="home-sidebar-logo logo-button" type="button" aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} title={collapsed ? "展开" : "收起"} data-label={collapsed ? "展开" : "收起"} onClick={onToggleCollapsed}>
        <GenoraMark />
        <span>Genora</span>
      </button>
      <nav aria-label="主导航">
        <Link className="logo-button active" href="/" title="首页" data-label="首页"><Icon name="home" /><span>首页</span></Link>
        <button className="logo-button home-sidebar-action" type="button" title="新聊天" data-label="新聊天" onClick={onNewChat}><Icon name="plus" /><span>新聊天</span></button>
        <div className={`home-search-anchor ${searchOpen ? "open" : ""}`}>
          <button className="logo-button home-sidebar-action" type="button" title="搜索聊天" data-label="搜索聊天" onClick={() => setSearchOpen((current) => !current)}><Icon name="search" /><span>搜索聊天</span></button>
          {searchOpen && (
            <div className="home-search-popover">
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索聊天" autoFocus />
              <div className="home-search-results">
                {searchResults.length ? searchResults.map((session) => (
                  <button key={session.id} type="button" className={session.id === activeSessionId ? "active" : ""} onClick={() => handleSelectSession(session.id)}>
                    <b>{session.title}</b>
                    <small>{new Date(session.updatedAt).toLocaleDateString("zh-CN")}</small>
                  </button>
                )) : <span>暂无匹配对话</span>}
              </div>
            </div>
          )}
        </div>
        <Link className="logo-button" href="/projects" title="工作空间" data-label="工作空间" onClick={handleWorkspace}><Icon name="nodes" /><span>工作空间</span></Link>
        {collapsed && (
          <div className={`home-chat-anchor ${chatsOpen ? "open" : ""}`}>
            <button className="home-chat-bubble" type="button" title="最近聊天" data-label="最近聊天" onClick={() => setChatsOpen((current) => !current)}>
              <Icon name="chat" />
            </button>
            {chatsOpen && (
              <div className="home-chat-popover">
                <header>最近对话</header>
                <div className="home-chat-results">
                  {visibleSessions.length ? visibleSessions.map((session) => (
                    <button key={session.id} type="button" className={session.id === activeSessionId ? "active" : ""} onClick={() => { onSelectSession(session.id); setChatsOpen(false); }}>
                      <b>{session.title}</b>
                      <small>{new Date(session.updatedAt).toLocaleDateString("zh-CN")}</small>
                    </button>
                  )) : <span>暂无最近对话</span>}
                </div>
                <button className="home-chat-new" type="button" onClick={() => { onNewChat(); setChatsOpen(false); }}><Icon name="plus" />新聊天</button>
              </div>
            )}
          </div>
        )}
      </nav>
      <section className="home-recent-chats" aria-label="最近对话">
        <header>最近对话</header>
        {visibleSessions.length ? (
          <div className="home-recent-list">
            {visibleSessions.map((session) => (
              <button key={session.id} type="button" className={session.id === activeSessionId ? "active" : ""} onClick={() => onSelectSession(session.id)} title={session.title}>
                {session.title}
              </button>
            ))}
          </div>
        ) : (
          <p>暂无最近对话</p>
        )}
      </section>
      <div className="home-sidebar-bottom">
        <div className={`home-user-anchor ${accountOpen ? "open" : ""}`}>
          <button className="logo-button home-user-button" type="button" title={isAuthed ? (user?.name ?? "账户") : "登录"} data-label={isAuthed ? (user?.name ?? "账户") : "登录"} onClick={handleUserClick}>
            <Icon name="user" />
            <span>{isAuthed ? (user?.name ?? "账户") : "登录"}</span>
          </button>
          {accountOpen && isAuthed && (
            <div className="home-user-popover">
              <header className="home-user-card-head">
                <span className="home-user-avatar"><Icon name="user" /></span>
                <span>
                  <b>{user?.name ?? "账户"}</b>
                  <small>{user?.email ?? ""}</small>
                </span>
              </header>
              <div className="home-user-plan"><span>额度</span><b>-- 积分</b></div>
              <div className="home-user-plan"><span>计划</span><b>Free</b></div>
              <button className="home-user-secondary" type="button" onClick={() => { logout(); setAccountOpen(false); }}><Icon name="logout" />退出登录</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
