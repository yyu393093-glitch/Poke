import { derivePetMessages } from '../../components/petModel.js';

export default function PetMessages({ pokes, onOpenNetwork, onPokeUpstream }) {
  const messages = derivePetMessages(pokes);
  return (
    <div className="pet-messages">
      {messages.length ? messages.map((m) => (
        <article className="pet-msg" key={m.id}>
          <div className="pet-msg-meta">
            <b>{m.from}</b><span>→</span><b>{m.to}</b>
            <time>{m.time}</time>
            <span className="pet-msg-channel">{m.channelLabel}</span>
          </div>
          <p className="pet-msg-body">{m.message}</p>
          {m.reply && <p className="pet-msg-reply">↩ {m.reply}</p>}
          <div className={`pet-msg-status pet-msg-${m.status}`}>
            {m.status === 'replied' ? '已回复' : m.status === 'read' ? '已读' : '已发送'}
          </div>
        </article>
      )) : <p className="pet-msg-empty">还没有协作消息</p>}
      <div className="pet-panel-actions">
        <button type="button" onClick={onPokeUpstream}>戳一下上游</button>
        <button type="button" onClick={onOpenNetwork}>打开协作网络</button>
      </div>
    </div>
  );
}
