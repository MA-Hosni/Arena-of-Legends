const boardSize = 7; // 7x7 arena
// Add these variables to the top of your board.js file
let playerInitiativeRolls = [];  // Store each player's initiative roll
let turnOrder = [];              // Array of player indexes in order of play
let currentPlayerIndex = 0;      // Index in turnOrder array
let gameStarted = false;         // Track if game has properly started with initiative
let selectedHeroes = {}; // Track selected heroes for each player

// Variables to track game state
let selectedAction = null;
let validMoveCells = [];
let playerPositions = {}; // To track player positions on the board
let playerHealth = {}; // Track each player's health
let playerDefense = {};
let ninjaAttackPhase = false;
let playerDefenseRounds = {}; // Track remaining rounds for each player's defense
let playerSpecialActive = {}; // Track if a player's special is active
let ninjaAttackCount = 0; // Track ninja's double attack count


document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const players = urlParams.get('players') || 2; // Default to 2 players if not specified

  addLogEntry(`Game started with ${players} players!`);
  generatePlayerCards(players);
  createBoard();

  // Add event listener to the "Start" button
  const startButton = document.querySelector('.start-btn');
  startButton.addEventListener('click', startGame);
});

function generatePlayerCards(players) {
  const playersContainer = document.querySelector('.players-container');
  playersContainer.innerHTML = ''; // Clear existing cards

  for (let i = 1; i <= players; i++) {
    playerHealth[i] = 120; // Initialize health for each player
    const playerCard = document.createElement('div');
    playerCard.classList.add('player-card');

    playerCard.innerHTML = `
      <h4>Player ${i}</h4>
      <div class="hero-selection">
        <img src="assets/chevalier.png" alt="knight" class="hero-image" onclick="selectHero(${i}, 'knight', this)">
        <img src="assets/ninja.png" alt="ninja" class="hero-image" onclick="selectHero(${i}, 'ninja', this)">
        <img src="assets/sorcier.png" alt="wizard" class="hero-image" onclick="selectHero(${i}, 'wizard', this)">
      </div>
      <!-- <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <label for="player${i}-coordinates">Initial Cell:</label>
        <input placeholder="e.g., 1.1" id="player${i}-coordinates" class="input" name="text" type="text"/>
      </div> -->
    `;

    playersContainer.appendChild(playerCard);
  }
}

function selectHero(player, hero, element) {
  // Remove highlight from previously selected hero for this player
  const playerCard = element.closest('.player-card');
  const heroImages = playerCard.querySelectorAll('.hero-image');
  heroImages.forEach(img => img.classList.remove('selected-hero'));

  // Highlight the selected hero
  element.classList.add('selected-hero');

  // Update the selected hero for the player
  selectedHeroes[player] = hero;
}

function createBoard() {
  const gameBoard = document.getElementById('game-board');
  
  // Set grid size dynamically
  gameBoard.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;

  for (let y = 1; y <= boardSize; y++) {
    for (let x = 1; x <= boardSize; x++) {
        const cell = document.createElement('div');
        cell.className = 'game-cell';
        cell.textContent = `${x},${y}`;
        gameBoard.appendChild(cell);
    }
  }
}

function startGame() {
  const playerCards = document.querySelectorAll('.player-card');
  const playerCount = playerCards.length;

  // Check if all players have selected their heroes
  for (let i = 1; i <= playerCount; i++) {
    if (!selectedHeroes[i]) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Player ${i} must select a hero before starting the game.`,
      });
      return; // Stop the game from starting
    }
  }

  // Log the final hero selections
  Object.keys(selectedHeroes).forEach(player => {
    addLogEntry(`Player ${player} selected ${selectedHeroes[player]}`);
  });

  // Proceed with the rest of the startGame logic
  const allCorners = [
    `1,1`,                     // Top-left
    `1,${boardSize}`,          // Bottom-left
    `${boardSize},1`,          // Top-right
    `${boardSize},${boardSize}` // Bottom-right
  ];

  let selectedCorners;
  if (playerCount === 2) {
    if (Math.random() < 0.5) {
      selectedCorners = [allCorners[0], allCorners[3]];
      addLogEntry('Placing players on primary diagonal corners.');
    } else {
      selectedCorners = [allCorners[1], allCorners[2]];
      addLogEntry('Placing players on secondary diagonal corners.');
    }
  } else {
    shuffleArray(allCorners);
    selectedCorners = allCorners.slice(0, playerCount);
  }

  playerCards.forEach((card, index) => {
    const heroImage = card.querySelector('.hero-image.selected-hero');
    const corner = selectedCorners[index];
    const [x, y] = corner.split(',').map(Number);
    const cellElement = document.querySelector(`.game-cell:nth-child(${(y - 1) * boardSize + x})`);

    cellElement.textContent = '';
    const heroClone = heroImage.cloneNode(true);
    heroClone.classList.remove('selected-hero');
    heroClone.setAttribute('data-player', `P${index + 1}`);
    cellElement.classList.add('occupied-cell');
    cellElement.setAttribute('data-player', `P${index + 1}`);
    cellElement.appendChild(heroClone);

    addLogEntry(`Player ${index + 1} placed on corner ${corner}`);
  });

  document.querySelector('.choose-hero').style.display = 'none';
  startInitiativePhase(playerCount);
}

// New function to handle the initiative rolling phase
function startInitiativePhase(playerCount) {
  // Update UI to show we're in initiative phase
  updateActionPanelForInitiative();
  
  // Show initiative instructions
  Swal.fire({
    title: 'Roll for Initiative!',
    text: 'Each player will roll the dice to determine turn order. Highest roll goes first!',
    icon: 'info',
    confirmButtonText: 'Start Rolling'
  }).then(() => {
    addLogEntry('Initiative phase started. Roll the dice to determine turn order!');
    promptNextPlayerInitiative(0, playerCount);
  });
}

// Update the action panel to show initiative phase info
function updateActionPanelForInitiative() {
  const actionPanel = document.querySelector('.action-panel');
  actionPanel.innerHTML = `
    <h3>Initiative Phase</h3>
    <div class="current-player">
      <h4>Roll for Turn Order</h4>
      <p>Each player will roll the dice. The highest roll determines who goes first.</p>
    </div>
    <p>Roll the dice when it's your turn.</p>
  `;
}

// Prompt each player to roll for initiative in sequence
function promptNextPlayerInitiative(playerIndex, totalPlayers) {
  if (playerIndex >= totalPlayers) {
    // All players have rolled, determine turn order
    determineTurnOrder();
    return;
  }
  
  Swal.fire({
    title: `Player ${playerIndex + 1}'s Turn to Roll`,
    text: 'Click "Roll Dice" to determine your position in turn order.',
    icon: 'info',
    confirmButtonText: 'Ready to Roll',
    allowOutsideClick: false
  }).then(() => {
    // Highlight the dice roll button
    const rollBtn = document.querySelector('.roll-btn');
    rollBtn.classList.add('highlight-btn');
    
    // Update roll button to handle initiative roll
    rollBtn.onclick = () => {
      rollInitiativeDice(playerIndex, totalPlayers);
      rollBtn.classList.remove('highlight-btn');
    };
  });
}

// Roll dice for initiative
function rollInitiativeDice(playerIndex, totalPlayers) {
  const dice = document.querySelector('.dice');
  
  // Add animation classes
  dice.style.animation = 'rotate 1s ease-in-out, move 1s ease-in-out';
  
  // Generate random number between 1 and 6
  const randomNumber = Math.floor(Math.random() * 6) + 1;
  
  // Set the appropriate dot pattern based on the roll
  setTimeout(() => {
    dice.style.animation = '';
      
    // Clear previous dot pattern
    dice.style.backgroundPosition = '';
      
    // Set new dot pattern based on roll
    switch(randomNumber) {
      case 1:
        dice.style.backgroundPosition = 'center center, -100px -100px, -100px -100px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 2:
        dice.style.backgroundPosition = '10px 10px, 40px 40px, -100px -100px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 3:
        dice.style.backgroundPosition = '10px 10px, center center, 40px 40px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 4:
        dice.style.backgroundPosition = '10px 10px, 40px 10px, 10px 40px, 40px 40px, -100px -100px, -100px -100px';
        break;
      case 5:
        dice.style.backgroundPosition = '10px 10px, 40px 10px, center center, 10px 40px, 40px 40px, -100px -100px';
        break;
      case 6:
        dice.style.backgroundPosition = '15px 10px, 35px 10px, 15px 25px, 35px 25px, 15px 40px, 35px 40px';
        break;
    }
      
    // Store the initiative roll
    playerInitiativeRolls[playerIndex] = {
      playerIndex: playerIndex,
      roll: randomNumber
    };
      
    // Update game log
    addLogEntry(`Player ${playerIndex + 1} rolled a ${randomNumber} for initiative!`);
    
    // Move to next player or determine turn order
    setTimeout(() => {
      promptNextPlayerInitiative(playerIndex + 1, totalPlayers);
    }, 1000);
  }, 1000);
}

// Determine the turn order based on initiative rolls
function determineTurnOrder() {
  // Sort players by their roll (highest to lowest)
  turnOrder = [...playerInitiativeRolls].sort((a, b) => b.roll - a.roll).map(p => p.playerIndex);
  
  // Handle ties by random determination
  // Note: For simplicity, we're not implementing tie-breaking rerolls here,
  // but you could extend this to handle those if desired
  
  // Log the turn order
  let orderMessage = 'Turn order determined: ';
  turnOrder.forEach((playerIndex, i) => {
    orderMessage += `Player ${playerIndex + 1}${i < turnOrder.length - 1 ? ' → ' : ''}`;
  });
  addLogEntry(orderMessage);
  
  // Update the UI to show turn order
  displayTurnOrder();
  // Update the game order list in the UI
  updateGameOrderList();
  // Start the actual game
  startGameplayPhase();
}

// Display the turn order in the UI
function displayTurnOrder() {
  let orderHTML = '<h3>Turn Order</h3><ol>';
  turnOrder.forEach(playerIndex => {
    orderHTML += `<li>Player ${playerIndex + 1} (rolled ${playerInitiativeRolls[playerIndex].roll})</li>`;
  });
  orderHTML += '</ol>';
  
  // Show the turn order in a modal
  Swal.fire({
    title: 'Initiative Results',
    html: orderHTML,
    icon: 'info',
    confirmButtonText: 'Begin Game'
  });
}

function updateGameOrderList() {
  const gameOrderList = document.querySelector('.initiative-roll ol');
  gameOrderList.innerHTML = ''; // Clear the existing list

  turnOrder.forEach(playerIndex => {
    const li = document.createElement('li');
    li.textContent = `Player ${playerIndex + 1}`;
    li.setAttribute('data-player', playerIndex + 1); // Add a data attribute for easier identification
    gameOrderList.appendChild(li);
  });
}

// Start the actual gameplay phase
function startGameplayPhase() {
  gameStarted = true;
  currentPlayerIndex = 0; // Start with the first player in turn order

  // Hide the h3 heading inside the initiative roll panel
  const initiativeHeading = document.querySelector('.initiative-roll h3');
  if (initiativeHeading) {
    initiativeHeading.style.display = 'none';
  }
  // Hide the roll dice button after game starts
  const rollBtn = document.querySelector('.roll-btn');
  if (rollBtn) {
    rollBtn.style.display = 'none';
  }

  // Update the UI for the first player's turn
  updateUIForCurrentPlayer();
  
  addLogEntry('Game has begun! Follow the established turn order.');
}

// Update the UI to show the current player's turn
function updateUIForCurrentPlayer() {
  const playerIndex = turnOrder[currentPlayerIndex];
  const playerNumber = playerIndex + 1;
  const selectedHero = selectedHeroes[playerNumber];

  // Define hero stats
  const heroStats = {
    knight: { health: 120, special: 'War Cry (+Damage)' },
    ninja: { health: 120, special: 'Shadow Strike (+Evasion)' },
    wizard: { health: 120, special: 'Arcane Blast (+Magic)' },
  };

  const hero = heroStats[selectedHero];
  const specialCooldown = playerSpecialCooldowns[playerNumber] || 0; // Track cooldowns

  // Update the action panel
  const actionPanel = document.querySelector('.action-panel');
  actionPanel.innerHTML = `
    <h3>Actions</h3>
    <div class="current-player">
      <h4>Current Player: Player ${playerNumber}</h4>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="hero-icon ${selectedHero}-icon">${selectedHero[0].toUpperCase()}</div>
        <div>
          <p style="font-size: small; font-weight: 500;">Health: ${playerHealth[playerNumber]}/120</p>
          <p style="font-size: small; font-weight: 500;">Special: ${
            specialCooldown === 0 ? 'Ready' : `${Math.ceil(specialCooldown/turnOrder.length)} rounds remaining`
          }</p>
        </div>
      </div>
      <p class="special">${hero.special}</p>
    </div>
    <div>
        <strong>Choose Action:</strong>
        <div class="actions">
            <button onclick="action('Move')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move"><path d="M12 2v20"></path><path d="m15 19-3 3-3-3"></path><path d="m19 9 3 3-3 3"></path><path d="M2 12h20"></path><path d="m5 9-3 3 3 3"></path><path d="m9 5 3-3 3 3"></path></svg>
                Move
            </button>
            <button onclick="action('Defend')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
                Defend
            </button>
            <button onclick="action('Quick')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
                Quick Attack
            </button>
            <button onclick="action('Heavy')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
                Heavy Attack
            </button>
            <button style="grid-column: span 2;" onclick="action('Special')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>
                Special Power
            </button>
        </div>
    </div>
  `;

  // Highlight the current player's hero
  const allHeroes = document.querySelectorAll('.occupied-cell img');
  allHeroes.forEach(hero => {
    hero.style.filter = ''; // Remove highlight from all heroes
  });

  const currentHero = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"] img`);
  if (currentHero) {
    currentHero.style.filter = 'drop-shadow(0px 5px 5px white)'; // Add highlight to the current player's hero
  }

  // Highlight the current player in the game order list
  const gameOrderListItems = document.querySelectorAll('.initiative-roll ol li');
  gameOrderListItems.forEach(item => {
    item.classList.remove('current-turn'); // Remove the highlight from all items
    if (item.getAttribute('data-player') == playerNumber) {
      item.classList.add('current-turn'); // Highlight the current player's item
    }
  });

  addLogEntry(`It's Player ${playerNumber}'s turn!`);
}

// Add a new object to track special cooldowns
let playerSpecialCooldowns = {};

// Function to end current player's turn and move to next
function endTurn() {
  // Reduce cooldowns for all players
  Object.keys(playerSpecialCooldowns).forEach(player => {
    if (playerSpecialCooldowns[player] > 0) {
      playerSpecialCooldowns[player]--;
    }
  });

  // Update defense rounds for all players
  Object.keys(playerDefenseRounds).forEach(player => {
    playerDefenseRounds[player]--;
    if (playerDefenseRounds[player] <= 0) {
      delete playerDefenseRounds[player];
      delete playerDefense[player];
      addLogEntry(`Player ${player}'s defense effect has ended.`);
    }
  });

  // Move to the next player in turn order
  currentPlayerIndex = (currentPlayerIndex + 1) % turnOrder.length;

  // Update the UI for the new current player
  updateUIForCurrentPlayer();
}

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Update the existing rollDice function to avoid conflict with initiative rolling
// (This is the original dice rolling function for general game actions)
function rollDice() {
  // If we're in the middle of initiative rolling, let that system handle it
  if (!gameStarted) {
    return;
  }
  
  const dice = document.querySelector('.dice');
  
  // Add animation classes
  dice.style.animation = 'rotate 1s ease-in-out, move 1s ease-in-out';
  
  // Generate random number between 1 and 6
  const randomNumber = Math.floor(Math.random() * 6) + 1;
  
  // Set the appropriate dot pattern based on the roll
  setTimeout(() => {
    dice.style.animation = '';
      
    // Clear previous dot pattern
    dice.style.backgroundPosition = '';
      
    // Set new dot pattern based on roll
    switch(randomNumber) {
      case 1:
        dice.style.backgroundPosition = 'center center, -100px -100px, -100px -100px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 2:
        dice.style.backgroundPosition = '10px 10px, 40px 40px, -100px -100px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 3:
        dice.style.backgroundPosition = '10px 10px, center center, 40px 40px, -100px -100px, -100px -100px, -100px -100px';
        break;
      case 4:
        dice.style.backgroundPosition = '10px 10px, 40px 10px, 10px 40px, 40px 40px, -100px -100px, -100px -100px';
        break;
      case 5:
        dice.style.backgroundPosition = '10px 10px, 40px 10px, center center, 10px 40px, 40px 40px, -100px -100px';
        break;
      case 6:
        dice.style.backgroundPosition = '15px 10px, 35px 10px, 15px 25px, 35px 25px, 15px 40px, 35px 40px';
        break;
    }
      
    // Update game log
    addLogEntry(`Player ${turnOrder[currentPlayerIndex] + 1} rolled a ${randomNumber}!`);
  }, 1000);
}

function findAdjacentTargets(x, y, playerNumber) {
  const cells = document.querySelectorAll('.game-cell');
  const found = [];

  // look only up/down/left/right
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  directions.forEach(dir => {
    const nx = x + dir.dx, ny = y + dir.dy;
    if (nx < 1 || nx > boardSize || ny < 1 || ny > boardSize) return;

    const idx = (ny - 1) * boardSize + (nx - 1);
    const cell = cells[idx];
    if (cell.classList.contains('occupied-cell') &&
        cell.getAttribute('data-player') !== `P${playerNumber}`) {
      found.push(cell);
    }
  });

  return found;
}
// Show valid attack targets based on hero type
function showValidAttackTargets(x, y, playerNumber) {
  const heroType = selectedHeroes[playerNumber];
  clearHighlightedCells();

  // ★ NINJA QUICK/HEAVY FLOW ★
  if (heroType === 'ninja' && (selectedAction === 'Quick' || selectedAction === 'Heavy')) {
    // 1) Are there any adjacent targets RIGHT NOW?
    const adjacent = findAdjacentTargets(x, y, playerNumber);

    if (adjacent.length) {
      // ——— Immediate attack, no move needed ———
      adjacent.forEach(cell => {
        cell.classList.add('valid-attack');
        cell.addEventListener('click', () => attackPlayer(cell), { once: true });
      });
      addLogEntry(`Ninja found a target! Attack immediately.`);
      return;
    }

    // 2) No adjacent targets → fall back to move-then-attack
    if (!ninjaAttackPhase) {
      ninjaAttackPhase = true;
      showValidMoves(x, y, playerNumber);
      validMoveCells.forEach(cell => {
        cell.setAttribute('data-attack-move', 'true');
      });
      addLogEntry(`No targets in range → Ninja may move then attack.`);
      return;
    }
    // 3) POST-MOVE: reset flag and let the normal logic below run
    ninjaAttackPhase = false;
  }

  // ——— NORMAL ADJACENT-ATTACK LOGIC for all heroes ———
  const attackRanges = { knight:{min:1,max:1}, ninja:{min:1,max:1}, wizard:{min:2,max:3} };
  const range = attackRanges[heroType];
  const cells = document.querySelectorAll('.game-cell');
  validMoveCells = [];

  for (let dx = -range.max; dx <= range.max; dx++) {
    for (let dy = -range.max; dy <= range.max; dy++) {
      const nx = x + dx, ny = y + dy;
      if (nx<1||nx>boardSize||ny<1||ny>boardSize) continue;
      const dist = Math.abs(dx)+Math.abs(dy);
      if (dist<range.min || dist>range.max) continue;
      if (heroType==='wizard' && dx!==0 && dy!==0) continue;

      const idx = (ny-1)*boardSize + (nx-1);
      const cell = cells[idx];
      if (cell.classList.contains('occupied-cell') &&
          cell.getAttribute('data-player') !== `P${playerNumber}`) {
        cell.classList.add('valid-attack');
        validMoveCells.push(cell);
        cell.addEventListener('click', () => attackPlayer(cell), { once: true });
      }
    }
  }

  if (validMoveCells.length === 0) {
    addLogEntry("No valid attack targets in range!");
    selectedAction = null;
    
    // Handle special cases for different heroes
    if (heroType === 'ninja') {
      addLogEntry("Ninja could not find any targets after moving. Ending turn.");
      setTimeout(endTurn, 500);
    } else if (heroType === 'knight' && playerSpecialActive[playerNumber]) {
      // If Knight's special is active but no targets, end the special and turn
      playerSpecialActive[playerNumber] = false;
      playerSpecialCooldowns[playerNumber] = turnOrder.length * 3;
      addLogEntry(`Player ${playerNumber}'s War Cry had no targets. Special ability is now on cooldown for 3 rounds (${turnOrder.length * 3} turns).`);
      setTimeout(endTurn, 500);
    } else {
      endTurn();
    }
  } else {
    addLogEntry("Select a target to attack");
  }
}


// Handle attack sequence
function attackPlayer(targetCell) {
  const playerIndex = turnOrder[currentPlayerIndex];
  const playerNumber = playerIndex + 1;
  const targetPlayer = targetCell.getAttribute('data-player').substring(1);
  const heroType = selectedHeroes[playerNumber];

  const dice = document.querySelector('.dice');
  const rollBtn = document.querySelector('.roll-btn');
  dice.style.display = 'block';
  rollBtn.style.display = 'block';
  rollBtn.classList.add('highlight-btn');

  rollBtn.onclick = () => {
    dice.style.animation = 'rotate 1s ease-in-out, move 1s ease-in-out';

    setTimeout(() => {
      dice.style.animation = '';
      const roll = Math.floor(Math.random() * 6) + 1;

      // Set dice face based on roll
      setDiceFace(dice, roll);

      let damage = 0;
      let hitType = '';

      if (roll <= 2) {
        hitType = 'miss';
        damage = 0;
      } else if (roll <= 5) {
        hitType = 'hit';
        damage = selectedAction === 'Quick' ? 20 : 30;
      } else {
        hitType = 'critical';
        damage = (selectedAction === 'Quick' ? 20 : 30) * 2;
      }

      // Apply Knight's special damage boost
      if (heroType === 'knight' && playerSpecialActive[playerNumber]) {
        damage *= 2;
        addLogEntry(`War Cry doubles the damage!`);
      }

      // Apply defense mechanics
      if (playerDefense[targetPlayer]) {
        const defense = playerDefense[targetPlayer];
        if (defense.type === 'immune') {
          damage = 0;
          addLogEntry(`Player ${targetPlayer} is immune to damage!`);
        } else if (defense.type === 'reduced') {
          damage = Math.max(0, damage - defense.value);
          addLogEntry(`Player ${targetPlayer} reduced damage by ${defense.value}.`);
        }
      }

      // Apply damage
      if (damage > 0) {
        playerHealth[targetPlayer] = Math.max(0, playerHealth[targetPlayer] - damage);
        addLogEntry(`Player ${playerNumber} ${hitType} Player ${targetPlayer} for ${damage} damage!`);

        if (playerHealth[targetPlayer] <= 0) {
          removePlayer(targetPlayer);
        }
      } else {
        addLogEntry(`Player ${playerNumber} missed Player ${targetPlayer}!`);
      }

      dice.style.display = 'none';
      rollBtn.style.display = 'none';
      rollBtn.classList.remove('highlight-btn');

      clearHighlightedCells();
      selectedAction = null;

      // For ninja's double attack, don't end turn after first attack
      if (heroType === 'ninja' && playerSpecialActive[playerNumber] && ninjaAttackCount < 2) {
        addLogEntry(`Choose your second attack!`);
      } else {
        endTurn();
      }
    }, 1000);
  };
}

// Helper function to set dice face based on roll
function setDiceFace(dice, roll) {
  const positions = [
    'center center, -100px -100px, -100px -100px, -100px -100px, -100px -100px, -100px -100px',
    '10px 10px, 40px 40px, -100px -100px, -100px -100px, -100px -100px, -100px -100px',
    '10px 10px, center center, 40px 40px, -100px -100px, -100px -100px, -100px -100px',
    '10px 10px, 40px 10px, 10px 40px, 40px 40px, -100px -100px, -100px -100px',
    '10px 10px, 40px 10px, center center, 10px 40px, 40px 40px, -100px -100px',
    '15px 10px, 35px 10px, 15px 25px, 35px 25px, 15px 40px, 35px 40px',
  ];
  dice.style.backgroundPosition = positions[roll - 1];
}

// Update removePlayer to handle defeated players in the game order list
function removePlayer(playerNumber) {
  // Remove from board
  const playerCell = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"]`);
  if (playerCell) {
    playerCell.classList.remove('occupied-cell');
    playerCell.removeAttribute('data-player');
    
    // Restore coordinates
    const cellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(playerCell);
    const y = Math.floor(cellIndex / boardSize) + 1;
    const x = (cellIndex % boardSize) + 1;
    playerCell.textContent = `${x},${y}`;
  }
  
  // Remove from turn order
  const playerIndex = turnOrder.indexOf(parseInt(playerNumber) - 1);
  if (playerIndex !== -1) {
    turnOrder.splice(playerIndex, 1);
  }
  
  // Update the game order list to show defeated player
  const gameOrderList = document.querySelector('.initiative-roll ol');
  const listItems = gameOrderList.querySelectorAll('li');
  listItems.forEach(item => {
    if (item.getAttribute('data-player') == playerNumber) {
      item.classList.add('defeated');
      item.style.textDecoration = 'line-through';
      item.style.opacity = '0.7';
      item.style.background = 'rgba(255, 0, 0, 0.2)';
      item.style.borderLeft = '4px solid #ff0000';
    }
  });
  
  addLogEntry(`Player ${playerNumber} has been defeated!`);
  
  // Check for game end
  if (turnOrder.length === 1) {
    const winner = turnOrder[0] + 1;
    Swal.fire({
      title: 'Game Over!',
      text: `Player ${winner} wins the game!`,
      icon: 'success',
      confirmButtonText: 'Play Again'
    }).then(() => {
      window.location.reload();
    });
  }
}

// Update the action function to handle special attacks
function action(actionType) {
  clearHighlightedCells();
  selectedAction = actionType;
  
  const playerIndex = turnOrder[currentPlayerIndex];
  const playerNumber = playerIndex + 1;
  const heroType = selectedHeroes[playerNumber];
  
  addLogEntry(`Player ${playerNumber} selected ${actionType}`);
  
  if (actionType === 'Special') {
    // Check if special is on cooldown
    if (playerSpecialCooldowns[playerNumber] > 0) {
      addLogEntry(`Special ability is on cooldown for ${playerSpecialCooldowns[playerNumber]} more turns!`);
      return;
    }

    // Handle special based on hero type
    if (heroType === 'wizard') {
      // Wizard's area damage special
      const playerCell = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"]`);
      if (!playerCell) {
        addLogEntry("Error: Couldn't find player position");
        return;
      }
      
      const cellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(playerCell);
      const y = Math.floor(cellIndex / boardSize) + 1;
      const x = (cellIndex % boardSize) + 1;
      
      // Show and highlight the area of effect
      const cells = document.querySelectorAll('.game-cell');
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || nx > boardSize || ny < 1 || ny > boardSize) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < 2 || dist > 3) continue;
          
          const idx = (ny - 1) * boardSize + (nx - 1);
          const cell = cells[idx];
          cell.classList.add('valid-attack');
          
          // If there's a player in this cell, damage them
          if (cell.classList.contains('occupied-cell')) {
            const targetPlayer = cell.getAttribute('data-player').substring(1);
            if (targetPlayer != playerNumber) {
              playerHealth[targetPlayer] = Math.max(0, playerHealth[targetPlayer] - 10);
              addLogEntry(`Player ${playerNumber}'s Magic Storm hit Player ${targetPlayer} for 10 damage!`);
              
              if (playerHealth[targetPlayer] <= 0) {
                removePlayer(targetPlayer);
              }
            }
          }
        }
      }
      
      // Set cooldown for 3 rounds (number of players × 3)
      playerSpecialCooldowns[playerNumber] = turnOrder.length * 3;
      addLogEntry(`Player ${playerNumber}'s special ability is now on cooldown for 3 rounds (${turnOrder.length * 3} turns).`);
      
      // End turn after a short delay
      setTimeout(() => {
        clearHighlightedCells();
        endTurn();
      }, 1000);
      
    } else if (heroType === 'ninja') {
      // Ninja's double attack special
      playerSpecialActive[playerNumber] = true;
      ninjaAttackCount = 0;
      
      // Update UI to show only attack buttons
      const actionPanel = document.querySelector('.action-panel');
      const actionsDiv = actionPanel.querySelector('.actions');
      actionsDiv.innerHTML = `
        <button onclick="action('Quick')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
          Quick Attack
        </button>
        <button onclick="action('Heavy')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
          Heavy Attack
        </button>
      `;
      
      addLogEntry(`Player ${playerNumber} activated Double Attack! Choose your first attack.`);
      
    } else if (heroType === 'knight') {
      // Knight's damage boost special
      playerSpecialActive[playerNumber] = true;
      
      // Update UI to show only attack buttons
      const actionPanel = document.querySelector('.action-panel');
      const actionsDiv = actionPanel.querySelector('.actions');
      actionsDiv.innerHTML = `
        <button onclick="action('Quick')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
          Quick Attack
        </button>
        <button onclick="action('Heavy')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sword"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line></svg>
          Heavy Attack
        </button>
      `;
      
      addLogEntry(`Player ${playerNumber} activated War Cry! Next attack will deal double damage.`);
    }
  } else if (actionType === 'Move') {
    const playerCell = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"]`);
    if (!playerCell) {
      addLogEntry("Error: Couldn't find player position");
      return;
    }
    
    const cellText = playerCell.textContent || '';
    const match = cellText.match(/(\d+),(\d+)/);
    
    if (!match) {
      const cellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(playerCell);
      const y = Math.floor(cellIndex / boardSize) + 1;
      const x = (cellIndex % boardSize) + 1;
      showValidMoves(x, y, playerNumber);
    } else {
      const [_, x, y] = match;
      showValidMoves(parseInt(x), parseInt(y), playerNumber);
    }
  } else if (actionType === 'Defend') {
    const heroType = selectedHeroes[playerNumber];

    if (heroType === 'ninja') {
      // Ninja rolls the dice to determine defense level
      const dice = document.querySelector('.dice');
      dice.style.display = 'block';

      const rollBtn = document.querySelector('.roll-btn');
      rollBtn.style.display = 'block';
      rollBtn.classList.add('highlight-btn');

      rollBtn.onclick = () => {
        dice.style.animation = 'rotate 1s ease-in-out, move 1s ease-in-out';

        setTimeout(() => {
          dice.style.animation = '';
          const roll = Math.floor(Math.random() * 6) + 1;

          // Set dice face based on roll
          setDiceFace(dice, roll);

          if (roll <= 4) {
            playerDefense[playerNumber] = { type: 'reduced', value: 15 }; // Reduce damage by 15
            addLogEntry(`Player ${playerNumber} (Ninja) will reduce incoming damage by 15.`);
          } else {
            playerDefense[playerNumber] = { type: 'immune' }; // Immune to damage
            addLogEntry(`Player ${playerNumber} (Ninja) is immune to all damage this turn.`);
          }

          // Set defense rounds to player count (one full round)
          playerDefenseRounds[playerNumber] = turnOrder.length;
          addLogEntry(`Player ${playerNumber}'s defense will last for ${turnOrder.length} turns.`);

          dice.style.display = 'none';
          rollBtn.style.display = 'none';
          rollBtn.classList.remove('highlight-btn');

          endTurn();
        }, 1000);
      };
    } else {
      // Other heroes reduce damage by 15
      playerDefense[playerNumber] = { type: 'reduced', value: 15 };
      addLogEntry(`Player ${playerNumber} will reduce incoming damage by 15.`);
      
      // Set defense rounds to player count (one full round)
      playerDefenseRounds[playerNumber] = turnOrder.length;
      addLogEntry(`Player ${playerNumber}'s defense will last for ${turnOrder.length} turns.`);
      
      endTurn();
    }
  } else if (actionType === 'Quick' || actionType === 'Heavy') {
    // Handle attacks with special effects
    if (playerSpecialActive[playerNumber]) {
      if (heroType === 'ninja') {
        ninjaAttackCount++;
        if (ninjaAttackCount >= 2) {
          playerSpecialActive[playerNumber] = false;
          playerSpecialCooldowns[playerNumber] = turnOrder.length * 3;
          addLogEntry(`Player ${playerNumber}'s Double Attack is complete. Special ability is now on cooldown for 3 rounds (${turnOrder.length * 3} turns).`);
        }
      } else if (heroType === 'knight') {
        playerSpecialActive[playerNumber] = false;
        playerSpecialCooldowns[playerNumber] = turnOrder.length * 3;
        addLogEntry(`Player ${playerNumber}'s War Cry is complete. Special ability is now on cooldown for 3 rounds (${turnOrder.length * 3} turns).`);
      }
    }
    
    ninjaAttackPhase = false;  
    const playerCell = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"]`);
    if (!playerCell) {
      addLogEntry("Error: Couldn't find player position");
      return;
    }
    
    const cellText = playerCell.textContent || '';
    const match = cellText.match(/(\d+),(\d+)/);
    
    if (!match) {
      const cellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(playerCell);
      const y = Math.floor(cellIndex / boardSize) + 1;
      const x = (cellIndex % boardSize) + 1;
      showValidAttackTargets(x, y, playerNumber);
    } else {
      const [_, x, y] = match;
      showValidAttackTargets(parseInt(x), parseInt(y), playerNumber);
    }
  }
}

// Show valid moves based on hero type
function showValidMoves(x, y, playerNumber) {
  // Get the hero type of the current player
  const heroType = selectedHeroes[playerNumber];
  
  // Store the current player's position
  playerPositions[playerNumber] = { x, y };
  
  // Clear any previously highlighted cells
  clearHighlightedCells();
  
  // Define movement range based on hero type
  const movementRange = heroType === 'ninja' ? 2 : 1;
  
  // Get all cells
  const cells = document.querySelectorAll('.game-cell');
  validMoveCells = [];
  
  // For each direction (up, down, left, right)
  const directions = [
    { dx: 0, dy: -1 }, // up
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 0 }   // right
  ];
  
  directions.forEach(dir => {
    // Check cells in this direction up to movement range
    for (let step = 1; step <= movementRange; step++) {
      const newX = x + dir.dx * step;
      const newY = y + dir.dy * step;
      
      // Check if the new position is within board boundaries
      if (newX < 1 || newX > boardSize || newY < 1 || newY > boardSize) {
        continue; // Skip if out of bounds
      }
      
      // Find the cell at the new position
      const cellIndex = (newY - 1) * boardSize + (newX - 1);
      if (cellIndex >= 0 && cellIndex < cells.length) {
        const cell = cells[cellIndex];
        
        // Check if the cell is occupied by another player
        if (!cell.classList.contains('occupied-cell')) {
          // Valid move
          cell.classList.add('valid-move');
          validMoveCells.push(cell);
          
          // Add click event to move
          cell.addEventListener('click', movePlayerToCell, { once: true });
        } else {
          // Cell is occupied, can't move through it
          break; // Stop checking further in this direction
        }
      }
    }
  });
  
  if (validMoveCells.length === 0) {
    addLogEntry("No valid moves available!");
    selectedAction = null;
  } else {
    addLogEntry(`Select a highlighted cell to move`);
  }
}

// Update movePlayerToCell to handle attack moves
function movePlayerToCell(event) {
  clearHighlightedCells();
  const targetCell = event.currentTarget;
  const playerIndex = turnOrder[currentPlayerIndex];
  const playerNumber = playerIndex + 1;
  const heroType = selectedHeroes[playerNumber];
  
  // Get current player position
  const currentPlayerCell = document.querySelector(`.occupied-cell[data-player="P${playerNumber}"]`);
  if (!currentPlayerCell) return;
  
  // Get player's hero image
  const heroImage = currentPlayerCell.querySelector('img');
  if (!heroImage) return;
  
  // Clear occupied status from current cell
  currentPlayerCell.classList.remove('occupied-cell');
  currentPlayerCell.removeAttribute('data-player');
  
  // Remove the hero image from the current cell
  currentPlayerCell.removeChild(heroImage);
  
  // Add text coordinates back if it was removed
  const cellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(currentPlayerCell);
  const oldY = Math.floor(cellIndex / boardSize) + 1;
  const oldX = (cellIndex % boardSize) + 1;
  currentPlayerCell.textContent = `${oldX},${oldY}`;
  
  // Set new cell as occupied
  targetCell.classList.add('occupied-cell');
  targetCell.setAttribute('data-player', `P${playerNumber}`);
  targetCell.textContent = '';  // Clear coordinates text
  targetCell.appendChild(heroImage);
  
  // Get new position for log
  const newCellIndex = Array.from(document.querySelectorAll('.game-cell')).indexOf(targetCell);
  const newY = Math.floor(newCellIndex / boardSize) + 1;
  const newX = (newCellIndex % boardSize) + 1;
  
  // Log the move
  addLogEntry(`Player ${playerNumber} moved from (${oldX},${oldY}) to (${newX},${newY})`);
  
  // Clear highlights before continuing
  clearHighlightedCells();
  
  // If this was an attack move, show attack targets after moving
  if (targetCell.hasAttribute('data-attack-move')) {
    targetCell.removeAttribute('data-attack-move');
    
    // For ninja, check for attack targets after movement
    if (heroType === 'ninja' && (selectedAction === 'Quick' || selectedAction === 'Heavy')) {
      showValidAttackTargets(newX, newY, playerNumber);
    }
  } else {
    // Regular move (not an attack-move)
    selectedAction = null;
    endTurn();
  }
}

// Update clearHighlightedCells to handle both move and attack highlights
function clearHighlightedCells() {
  const highlightedCells = document.querySelectorAll('.valid-move, .valid-attack');
  highlightedCells.forEach(cell => {
    cell.classList.remove('valid-move', 'valid-attack');
    cell.removeEventListener('click', movePlayerToCell);
    cell.removeEventListener('click', () => attackPlayer(cell));
  });
  validMoveCells = [];
}

// Add CSS for valid move cells
function addMovementStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .valid-move {
      background: rgba(0, 255, 0, 0.3) !important;
      box-shadow: 0 0 10px #00ff00;
      cursor: pointer !important;
      animation: pulse-green 1.5s infinite;
    }
    
    @keyframes pulse-green {
      0% {
        box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(0, 255, 0, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(0, 255, 0, 0);
      }
    }
  `;
  document.head.appendChild(style);
}

// Initialize movement functionality
document.addEventListener('DOMContentLoaded', function() {
  // Add the required styles when the DOM is loaded
  addMovementStyles();
  
  // Make sure the action function is globally available
  window.action = action;
});

function addLogEntry(message) {
  const log = document.querySelector('.game-log');
  const entry = document.createElement('p');
  entry.className = 'log-entry';
  entry.textContent = message;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}