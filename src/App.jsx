import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';

import { GameProvider } from './context/GameContext.jsx';
import DeskPetPage from './pages/DeskPetPage.jsx';
import NetworkPage from './pages/NetworkPage.jsx';

/**
 * 单文件离线版（scripts/build-standalone.mjs）用 file:// 打开，
 * BrowserRouter 在 file:// 下匹配不到路由，所以改用 HashRouter，
 * 并且直接落在协作地图页。正常的 dev / build 行为不受影响。
 */
const STANDALONE = import.meta.env.VITE_STANDALONE === '1';
const Router = STANDALONE ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={STANDALONE ? <NetworkPage /> : <DeskPetPage />} />
          <Route path="/network" element={<NetworkPage />} />
        </Routes>
      </Router>
    </GameProvider>
  );
}
