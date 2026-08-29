import { useState } from 'react';
import CapybaraAvatar from '../../components/CapybaraAvatar.jsx';
import FlowPeek from './FlowPeek.jsx';
import PetMessages from './PetMessages.jsx';

export default function PetPanel({ progress, peek, pokes, onClose, onOpenNetwork, onPokeUpstream }) {
  const [tab, setTab] = useState('deps');
  return (
    <section className="pet-panel" role="dialog" aria-label="宠物面板">
      <header className="pet-panel-head">
        <div className="pet-panel-title">
          <span className="pet-panel-avatar"><CapybaraAvatar size={30} /></span>
          <div><b>{progress.projectName}</b><small>{progress.headline}</small></div>
        </div>
        <button type="button" className="pet-panel-close" onClick={onClose} aria-label="关闭">×</button>
      </header>
      <nav className="pet-panel-tabs">
        <button type="button" className={tab === 'deps' ? 'is-active' : ''} onClick={() => setTab('deps')}>依赖</button>
        <button type="button" className={tab === 'messages' ? 'is-active' : ''} onClick={() => setTab('messages')}>消息</button>
      </nav>
      <div className="pet-panel-body">
        {tab === 'deps' ? <FlowPeek peek={peek} onOpenNetwork={onOpenNetwork} onPokeUpstream={onPokeUpstream} /> : <PetMessages pokes={pokes} onOpenNetwork={onOpenNetwork} onPokeUpstream={onPokeUpstream} />}
      </div>
    </section>
  );
}
