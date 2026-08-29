import { createContext, useContext, useReducer } from 'react';

export const PHASES = {
  IDLE: 'IDLE',
  OPEN: 'OPEN',
  ACTIVE: 'ACTIVE',
  OFF: 'OFF',
};

const initialState = {
  phase: 'IDLE',
  nodes: [],
  edges: [],
  pokes: [],
  notifications: [],
  currentUser: '小陈',
  integrity: 100,
  escapeProgress: 0,
  metrics: { doneToday: 0, alignedPeople: 0, blocked: 0 },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'SET_NODES':
      return { ...state, nodes: action.payload };
    case 'SET_EDGES':
      return { ...state, edges: action.payload };
    case 'ADD_POKE':
      return { ...state, pokes: [...state.pokes, action.payload] };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case 'UPDATE_NODE_STATUS':
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.payload.nodeId
            ? { ...node, status: action.payload.status }
            : node,
        ),
      };
    case 'SET_METRICS':
      return { ...state, metrics: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const GameContext = createContext(undefined);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);

  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }

  return context;
}
