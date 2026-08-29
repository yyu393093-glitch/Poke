// 结果展示面板：人员 / 任务 / 依赖 + 推荐分工卡片
// 推荐分工卡片按 action 上色：review 蓝 · align 橙 · notify 灰 · assign 绿

const ACTION_COLORS = {
  review: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  align: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  notify: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  assign: 'border-green-500/40 bg-green-500/10 text-green-300',
};

const ACTION_LABELS = {
  review: '审核',
  align: '对齐',
  notify: '通知',
  assign: '指派',
};

const STATUS_COLORS = {
  done: 'text-green-400',
  doing: 'text-yellow-400',
  todo: 'text-slate-400',
};

function AssignmentCard({ assignment }) {
  const color = ACTION_COLORS[assignment.action] ?? ACTION_COLORS.notify;
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{assignment.taskTitle}</span>
        <span className="rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide opacity-90">
          {ACTION_LABELS[assignment.action] ?? assignment.action}
        </span>
      </div>
      <p className="mt-1 text-sm">
        推荐负责人：<span className="font-medium">{assignment.recommendedOwner}</span>
      </p>
      {assignment.reason && (
        <p className="mt-1 text-xs opacity-80">{assignment.reason}</p>
      )}
      {Array.isArray(assignment.alternatives) &&
        assignment.alternatives.length > 0 && (
          <p className="mt-1 text-xs opacity-70">
            备选：{assignment.alternatives.join('、')}
          </p>
        )}
    </div>
  );
}

export default function DocParsePanel({ result }) {
  const people = result?.people ?? [];
  const tasks = result?.tasks ?? [];
  const dependencies = result?.dependencies ?? [];
  const assignments = result?.recommendedAssignments ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="m-0 text-lg font-semibold">
          {result?.source || '未命名文档'}
        </h2>
        {result?.summary && (
          <p className="m-0 mt-1 text-sm text-slate-400">{result.summary}</p>
        )}
      </header>

      <section>
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          人员（{people.length}）
        </h3>
        {people.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">无</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {people.map((person, index) => (
              <li
                key={`${person.name}-${index}`}
                className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3"
              >
                <span className="font-medium">{person.name}</span>
                {person.dept && (
                  <span className="ml-2 text-xs text-slate-400">
                    {person.dept}
                  </span>
                )}
                {person.role && (
                  <span className="ml-2 text-xs text-slate-400">
                    {person.role}
                  </span>
                )}
                {Array.isArray(person.ownsModules) &&
                  person.ownsModules.length > 0 && (
                    <p className="m-0 mt-1 text-xs text-slate-400">
                      负责模块：{person.ownsModules.join('、')}
                    </p>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          任务（{tasks.length}）
        </h3>
        {tasks.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">无</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {tasks.map((task, index) => (
              <li
                key={task.id || `${task.title}-${index}`}
                className="flex items-center justify-between gap-2 rounded border border-slate-700/60 bg-slate-800/40 px-3 py-2"
              >
                <span>{task.title}</span>
                <span className="text-xs text-slate-400">
                  {task.owner}
                  {task.module ? ` · ${task.module}` : ''}
                  {task.status ? (
                    <span
                      className={`ml-2 ${STATUS_COLORS[task.status] ?? 'text-slate-400'}`}
                    >
                      {task.status}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          依赖（{dependencies.length}）
        </h3>
        {dependencies.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">无</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {dependencies.map((dep, index) => (
              <li
                key={`${dep.from}-${dep.to}-${index}`}
                className="rounded border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{dep.from}</span>
                <span className="mx-2 text-slate-500">→</span>
                <span className="font-medium">{dep.to}</span>
                {dep.type && (
                  <span className="ml-2 text-xs text-slate-400">
                    {dep.type}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          推荐分工（{assignments.length}）
        </h3>
        {assignments.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">无</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {assignments.map((assignment, index) => (
              <AssignmentCard
                key={`${assignment.taskTitle}-${assignment.recommendedOwner}-${assignment.action}-${index}`}
                assignment={assignment}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
