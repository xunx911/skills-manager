import Link from "next/link";
import type { ReactNode } from "react";

import { GlobalCommandButton } from "@/components/command-menu/global-command-button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skipLink" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div>
          <Link href="/skills" className="brand">
            <span className="brandMark">SH</span>
            <span>
              <strong>SkillHub</strong>
              <small>Evidence-backed skills</small>
            </span>
          </Link>
          <div className="workspacePill">
            <span className="statusDot" />
            skillhub-lab
          </div>
          <nav className="nav" aria-label="Main navigation">
            <span className="navLabel">Browse</span>
            <Link href="/skills">Skill Hub</Link>
            <span className="navLabel">Evidence</span>
            <Link href="/skills">测评集</Link>
            <Link href="/skills">测评结果</Link>
          </nav>
        </div>
        <div className="sidebarFooter">
          <span>Formal UI v0.1</span>
          <strong>Exact version evidence</strong>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <div className="topbar">
          <div>
            <span className="topbarLabel">Production workspace</span>
            <strong>Verified skill operations</strong>
          </div>
          <div className="topbarActions">
            <GlobalCommandButton />
            <button className="avatarButton" aria-label="Current user">XX</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="pageHeader">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="pageDescription">{description}</p>
      </div>
      {actions ? <div className="headerActions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="sectionHeader">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "blue" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "bad" | "blue" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
