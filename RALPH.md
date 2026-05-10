# Ralph Loop 运行说明

本项目已安装 Ralph Loop，用来把 `.agent/tasks.json` 中的任务交给 Docker Sandboxes 内的 agent 逐轮执行。

## Sandbox 命名

当前项目的 Codex sandbox 名称：

```bash
ralph-codex-skills-manager-a715ab0b
```

命名规则由 `ralph.sh` 和 `scripts/lib/agents.sh` 维护：

```text
ralph-{agent}-{project-name}-{project-path-hash}
```

## 本地 `sbx`

当前环境使用项目本地的 Docker Sandboxes 二进制：

```bash
.tools/sbx/bin/sbx
```

`.tools/` 已加入 `.gitignore`，不要提交二进制文件。

如果系统 PATH 中没有 `sbx`，运行 Ralph 时使用：

```bash
PATH="$PWD/.tools/sbx/bin:$PATH" ./ralph.sh --agent codex
```

在当前 Codex 沙箱环境中，`sbx` 的登录状态需要落在可写目录，可使用：

```bash
HOME=/private/tmp/skillhub-sbx-home PATH="$PWD/.tools/sbx/bin:$PATH" sbx login
```

如果在普通终端运行，通常直接执行：

```bash
sbx login
./ralph.sh --agent codex
```

## 当前任务

Ralph 的正式任务入口：

- `.agent/tasks.json`
- `.agent/tasks/TASK-001.json`
- `.agent/tasks/TASK-002.json`
- `.agent/tasks/TASK-003.json`

每一轮只允许完成一个任务，提交后停止。Ralph 脚本再进入下一轮。
