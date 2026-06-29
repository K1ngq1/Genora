import Link from "next/link";
import { GenoraMark, Icon } from "@/features/home/home-icons";

type HomeSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function HomeSidebar({ collapsed, onToggleCollapsed }: HomeSidebarProps) {
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
        <Link className="logo-button" href="/settings" title="设置" data-label="设置"><Icon name="settings" /><span>设置</span></Link>
        <button className="home-collapse" type="button" onClick={onToggleCollapsed} title={collapsed ? "展开" : "收起"} data-label={collapsed ? "展开" : "收起"}>
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
          <span>{collapsed ? "展开" : "收起"}</span>
        </button>
      </div>
    </aside>
  );
}
