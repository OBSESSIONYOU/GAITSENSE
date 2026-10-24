# 仓库安全维护

Dependabot 每周检查依赖和 GitHub Actions；漏洞提醒和安全修复 PR 已开启。更新 PR 通过现有测试及 Privacy Guard 后，由维护者检查并合入，不自动批准或合并。

常规 npm 版本更新仅选择 minor / patch；major 迁移需单独评估兼容性。`allow.update-types` 不限制漏洞修复更新，漏洞提醒及安全修复 PR 保持开启。CI 使用官方 npm registry 审计，发现 high / critical 漏洞会阻断检查。

Pages 构建按 PR 编号或分支隔离并发，避免不同 PR 的待运行检查互相取消；正式部署只允许 main 分支的非 PR 运行。

本机新克隆仍需执行 `python scripts/privacy_guard.py install`。本机钩子负责上传前拦截，CI 在对象上传后检查，分支保护只约束正式分支的合入，不能代替上传前检查。

发布分支启用分支保护时，使用 PR 合入并等待要求的检查通过；维护者无需第二个账号批准自己的 PR。自动更新也走更新分支和 PR。禁止强推和删除发布分支。
