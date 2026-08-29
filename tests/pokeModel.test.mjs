import test from 'node:test';
import assert from 'node:assert/strict';

const model = await import('../src/components/pokeModel.js').catch(() => null);

test('演示模式启用假 IM 和灯仔，生产模式全部关闭', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  assert.deepEqual(model.getPokePresentation(true), { fakeIM: true, flyingLamp: true, toast: false });
  assert.deepEqual(model.getPokePresentation(false), { fakeIM: false, flyingLamp: false, toast: true });
});

test('接口响应会被标准化为可记录的 Poke 事件', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  assert.deepEqual(model.buildPokeEvent({ message: '请确认进度', channel: 'feishu', pokeId: 'poke-1', pushStatus: 'success', reply: null }, { from: '小陈', to: 'n_brand', receiver: '陈总', time: '17:57:32' }), {
    id: 'poke-1', from: '小陈', to: 'n_brand', receiver: '陈总', message: '请确认进度', reply: null, channel: 'feishu', time: '17:57:32', pushStatus: 'success',
  });
});

test('生产推送失败时返回明确失败提示', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  assert.equal(model.getPushToast({ channel: 'wecom', pushStatus: 'fail' }), '企业微信催办发送失败，请稍后重试');
});

test('只有演示模式可在接口不可用时生成本地催办结果', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  assert.deepEqual(model.getPokeFallback(true, { owner: '陈总', name: '品牌素材' }, '小陈', 'poke-demo'), {
    message: '陈总好，小陈负责的工作正在等待「品牌素材」，方便确认一下进度吗？🙏',
    reply: '收到，10分钟内发你🙌',
    channel: 'feishu',
    pokeId: 'poke-demo',
    pushStatus: 'success',
  });
  assert.equal(model.getPokeFallback(false, { owner: '陈总', name: '品牌素材' }, '小陈', 'poke-prod'), null);
});

test('演示悬浮窗会避开右侧任务详情操作区', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  assert.deepEqual(model.getFloatingWindowOffset(320, 20), { right: 340, bottom: 20 });
});

test('灯仔抵达后会把催办消息放入悬浮窗并结束飞行', () => {
  assert.ok(model, 'pokeModel 尚未实现');
  const poke = { id: 'poke-1', message: '请确认进度' };
  assert.deepEqual(model.completeDemoFlight({ poke }, []), { flight: null, messages: [poke] });
  assert.deepEqual(model.completeDemoFlight(null, [poke]), { flight: null, messages: [poke] });
});
