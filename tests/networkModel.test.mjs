import test from 'node:test';
import assert from 'node:assert/strict';

const model = await import('../src/components/networkModel.js').catch(() => null);
const layout = await import('../src/components/networkLayout.js').catch(() => null);

test('品牌素材延期会递归影响设计、开发和测试', () => {
  assert.ok(model, 'networkModel 尚未实现');
  assert.deepEqual(model.getDownstream('n_brand', model.FALLBACK_NODES, model.FALLBACK_EDGES).map(node => node.id), [
    'n_design', 'n_dev', 'n_test',
  ]);
});

test('完成首页设计稿会解锁两个直接下游并清除瓶颈', () => {
  assert.ok(model, 'networkModel 尚未实现');
  const nodes = model.completeDesign(model.FALLBACK_NODES);
  assert.equal(nodes.find(node => node.id === 'n_design').status, 'done');
  assert.equal(nodes.find(node => node.id === 'n_design').isBottleneck, false);
  assert.equal(nodes.find(node => node.id === 'n_dev').status, 'doing');
  assert.equal(nodes.find(node => node.id === 'n_test').status, 'doing');
});

test('主动作按阻塞检查、任务推进和价值查看依次变化', () => {
  assert.ok(model, 'networkModel 尚未实现');
  assert.equal(model.getPrimaryAction('n_brand', model.FALLBACK_NODES).kind, 'inspect-impact');
  assert.equal(model.getPrimaryAction('n_design', model.FALLBACK_NODES).kind, 'complete-design');
  assert.equal(model.getPrimaryAction('n_design', model.completeDesign(model.FALLBACK_NODES)).kind, 'view-ripple');
});

test('地图与详情固定在互不重叠的网格区域', () => {
  assert.ok(layout, 'networkLayout 尚未实现');
  assert.deepEqual(layout.NETWORK_LAYOUT, {
    graph: 'col-start-1 row-start-2',
    detail: 'col-start-2 row-start-1 row-span-2',
  });
});

test('交互层可以通过节点 id 获取稳定的地图锚点', () => {
  assert.ok(model, 'networkModel 尚未实现');
  assert.equal(model.getNodeAnchorSelector('n_brand'), '[data-node-id="n_brand"]');
  assert.equal(model.getNodeAnchorSelector(''), null);
});
