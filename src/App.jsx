import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { GameProvider } from './context/GameContext.jsx';
import DeskPetPage from './pages/DeskPetPage.jsx';
import NetworkPage from './pages/NetworkPage.jsx';
import AiFloatWindow from './features/assistant/AiFloatWindow.jsx';
import PetWindow from './features/pet/PetWindow.jsx';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DeskPetPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/pet" element={<PetWindow />} />
          <Route path="/assistant" element={<AiFloatWindow />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
