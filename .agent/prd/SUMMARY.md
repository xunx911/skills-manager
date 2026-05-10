# SkillHub 产品摘要

SkillHub 是一个面向 agent / skill 的管理与验证平台。它不是普通的文件分发站点，而是把 skill 的内容版本、约束变体、测评集版本、逐用例测评结果和设为当前版本决策串成闭环。

当前正式版目标：

- 首页用于查找 skill。
- skill 本质上引用某个 variant；variant 表示一组 tags 约束下人为维护的最佳版本。
- variant current version 是一个指针，指向不可变的 `VariantVersion`。
- `VariantVersion` 存储标准 skill bundle 文件树快照，支持查看文件和版本 diff。
- `EvalSetVersion` 引用不可变 case version，测评结果必须绑定 `VariantVersion + EvalSetVersion`。
- 用户可以添加 skill、添加 variant、上传新版本、管理测试用例、创建测试集版本、手动记录每条 case 通过/不通过。
- 用户可以查看测评历史、case 历史、版本历史，并基于证据决定是否把候选版本设为当前版本。

下一阶段重点是“设为当前版本评审”：候选版本不能只靠一个裸按钮变成当前版本，必须展示文件差异、逐 case 修复/回退、测评绑定证据、风险理由和结构化决策记录。
