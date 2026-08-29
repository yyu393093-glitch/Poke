/**
 * 把 Leader 的一段话拆成分点分条的要求。
 * 真实版本会调 LLM；本 demo 按写死的规则拆（见开发契约禁令第 3 条）。
 *
 * 前后端共用同一份实现，避免两边规则漂移。
 */
const P0_WORDS = ['必须', '务必', '一定', '不然', '立刻', '优先保证'];
const P2_WORDS = ['尽量', '方便', '如果', '可以', '就行'];
const DUE_PATTERN = /(今天\s*\d{1,2}:\d{2}|今天|明天|本周内|本周|下周)/;

export function splitBrief(raw) {
  return raw
    .split(/[；;。]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 3)
    .map((sentence, index) => {
      const hit = (words) => words.some((word) => sentence.includes(word));
      const priority = hit(P0_WORDS) ? 'P0' : hit(P2_WORDS) ? 'P2' : 'P1';
      const due = sentence.match(DUE_PATTERN)?.[1] ?? null;
      const head = sentence.split(/[，,、]/)[0];
      const title = head.length > 16 ? `${head.slice(0, 16)}…` : head;

      return { id: `r${index + 1}`, title, detail: sentence, priority, due };
    });
}
