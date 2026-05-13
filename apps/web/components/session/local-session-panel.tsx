"use client";

import type { FormEvent } from "react";

type LocalSessionPanelProps = {
  actor: string;
  busy: boolean;
  onSwitchActor: (event: FormEvent<HTMLFormElement>) => void;
};

export function LocalSessionPanel({ actor, busy, onSwitchActor }: LocalSessionPanelProps) {
  return (
    <section className="localSessionPanel">
      <div className="localSessionHeader">
        <div>
          <span>Local session</span>
          <strong>{actor}</strong>
        </div>
        <small>HttpOnly signed cookie</small>
      </div>
      <p>本地 actor 负责创建、审计和权限归属；正式登录接入后会替换这里的本地身份。</p>
      <form className="localSessionForm" onSubmit={onSwitchActor}>
        <label>
          <span>切换 actor</span>
          <input name="actor" placeholder="release-manager" />
        </label>
        <button disabled={busy} type="submit">切换 actor</button>
      </form>
    </section>
  );
}
