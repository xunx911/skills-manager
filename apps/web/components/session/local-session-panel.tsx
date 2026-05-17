"use client";

import type { FormEvent } from "react";

import { ValidatedForm } from "@/components/forms/form-validation";
import { TextField } from "@/components/forms/workbench-field";

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
          <span>Local login</span>
          <strong>{actor}</strong>
        </div>
        <small>HttpOnly session</small>
      </div>
      <p>本地登录码保护 actor session；正式认证接入后会替换为真实登录。</p>
      <ValidatedForm className="localSessionForm" onValidSubmit={onSwitchActor}>
        <TextField label="Actor" name="actor" placeholder="release-manager" required />
        <TextField
          data-required-message="填写本地登录码。"
          label="本地登录码"
          name="access_code"
          placeholder="skillhub-dev"
          required
          type="password"
        />
        <button disabled={busy} type="submit">登录 actor</button>
      </ValidatedForm>
    </section>
  );
}
