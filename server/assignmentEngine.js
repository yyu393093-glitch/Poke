// 推荐分工规则引擎：模型先产出 recommendedAssignments，这里做补全 + 去重。
//
// 规则（对应 spec 第 8 节 + Q4「orgChart 既存又用」）：
// 1. 每个 task.module 匹配 people[].ownsModules 里的人 → 生成 assign 推荐；
// 2. dependencies 的 from→to → 给下游 owner 生成 notify；
// 3. 跨部门任务 → 生成 align 推荐；
// 4. orgChart.reporting（from=上级, to=下级）→ 给任务 owner 的直属上级生成 notify；
// 5. 同一 task + 同一人 + 同一 action 只留一条。

const VALID_ACTIONS = new Set(['review', 'align', 'notify', 'assign']);

function normalizeAssignment(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const action = VALID_ACTIONS.has(raw.action) ? raw.action : 'notify';
  const taskTitle = typeof raw.taskTitle === 'string' ? raw.taskTitle : '';
  const recommendedOwner =
    typeof raw.recommendedOwner === 'string' ? raw.recommendedOwner : '';
  if (!taskTitle || !recommendedOwner) {
    return null;
  }
  return {
    taskTitle,
    action,
    recommendedOwner,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [],
  };
}

// doc = 模型解析出的 PokeDocument；globalOrgChart = store.orgChart（由 /api/org/import 导入）
export function enrichAssignments(doc, globalOrgChart) {
  const people = Array.isArray(doc?.people) ? doc.people : [];
  const tasks = Array.isArray(doc?.tasks) ? doc.tasks : [];
  const deps = Array.isArray(doc?.dependencies) ? doc.dependencies : [];

  // 合并文档自带 orgChart 与全局 orgChart 的汇报线（Q4：既存又用）
  const docOrg = doc?.orgChart ?? {};
  const globalOrg = globalOrgChart ?? {};
  const reporting = [
    ...(Array.isArray(docOrg.reporting) ? docOrg.reporting : []),
    ...(Array.isArray(globalOrg.reporting) ? globalOrg.reporting : []),
  ];

  const out = [];
  const seen = new Set();

  const key = (taskTitle, owner, action) =>
    `${taskTitle}||${owner}||${action}`;

  const push = (assignment) => {
    const k = key(assignment.taskTitle, assignment.recommendedOwner, assignment.action);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(assignment);
    }
  };

  // 先保留模型产出的合法推荐
  for (const raw of Array.isArray(doc?.recommendedAssignments)
    ? doc.recommendedAssignments
    : []) {
    const normalized = normalizeAssignment(raw);
    if (normalized) {
      push(normalized);
    }
  }

  const personByName = (name) => people.find((p) => p.name === name);
  const moduleOwners = (module) =>
    people.filter(
      (p) => Array.isArray(p.ownsModules) && p.ownsModules.includes(module),
    );

  // 1. module → assign（该模块该由谁负责）
  for (const task of tasks) {
    if (!task.module) continue;
    const owners = moduleOwners(task.module);
    for (const owner of owners) {
      push({
        taskTitle: task.title,
        action: 'assign',
        recommendedOwner: owner.name,
        reason: `「${task.title}」涉及模块「${task.module}」，由 ${owner.name} 负责`,
        alternatives: owners
          .filter((o) => o.name !== owner.name)
          .map((o) => o.name),
      });
    }
  }

  // 2. dependencies from→to → notify 下游 owner
  for (const dep of deps) {
    const toTask =
      tasks.find((t) => t.id === dep.to) ||
      tasks.find((t) => t.title === dep.to);
    if (toTask && toTask.owner) {
      push({
        taskTitle: toTask.title,
        action: 'notify',
        recommendedOwner: toTask.owner,
        reason: `上游「${dep.from ?? ''}」完成后需通知下游「${toTask.title}」`,
        alternatives: [],
      });
    }
  }

  // 3. 跨部门任务 → align（任务 owner 与模块 owner 分属不同部门时对齐）
  for (const task of tasks) {
    if (!task.module || !task.owner) continue;
    const taskOwner = personByName(task.owner);
    const taskDept = taskOwner?.dept;
    if (!taskDept) continue;
    for (const owner of moduleOwners(task.module)) {
      if (owner.name === task.owner) continue;
      if (owner.dept && owner.dept !== taskDept) {
        push({
          taskTitle: task.title,
          action: 'align',
          recommendedOwner: owner.name,
          reason: `「${task.title}」跨部门：${taskDept} 与 ${owner.dept} 需对齐`,
          alternatives: [],
        });
      }
    }
  }

  // 4. orgChart.reporting → 给任务 owner 的直属上级生成 notify
  for (const task of tasks) {
    if (!task.owner) continue;
    for (const rel of reporting) {
      if (rel && rel.to === task.owner && rel.from && rel.from !== task.owner) {
        push({
          taskTitle: task.title,
          action: 'notify',
          recommendedOwner: rel.from,
          reason: `「${task.title}」负责人 ${task.owner} 的直属上级是 ${rel.from}，需知会`,
          alternatives: [],
        });
      }
    }
  }

  return out;
}
