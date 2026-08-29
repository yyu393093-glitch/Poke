import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { GameProvider } from './context/GameContext.jsx';
import DeskPetPage from './pages/DeskPetPage.jsx';
import NetworkPage from './pages/NetworkPage.jsx';
import DocParsePage from './pages/DocParsePage.jsx';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DeskPetPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/doc" element={<DocParsePage />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
