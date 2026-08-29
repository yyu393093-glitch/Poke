import { useGame } from '../context/GameContext.jsx';

export default function NetworkPage() {
  const { state } = useGame();

  return (
    <main
      className="grid min-h-screen place-items-center bg-slate-950 text-slate-100"
      data-phase={state.phase}
    >
      <div>网络图 TODO</div>
    </main>
  );
}
