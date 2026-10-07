import { initializeGame } from './src/setup.js';
import { bindInput } from './src/input.js';
import { startLoop } from './src/loop.js';
import { initializeLobby } from './src/lobby.js';
initializeGame();
initializeLobby();
bindInput();
startLoop();
