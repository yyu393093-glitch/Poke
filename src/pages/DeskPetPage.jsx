import DeskPet from '../components/DeskPet.jsx';

export default function DeskPetPage() {
  return (
    <main className="desktop-background relative min-h-screen overflow-hidden">
      <p className="fixed right-36 bottom-10 m-0 text-sm tracking-wide text-slate-400">
        17:57 · 下班前，点一下灯仔对齐今天的工作
      </p>
      <DeskPet />
    </main>
  );
}
