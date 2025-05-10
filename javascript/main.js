document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('showGameInfoBtn');
  
  btn.addEventListener('click', function () {
    Swal.fire({
      title: 'Game Instructions',
      html: `
        <strong>Goal:</strong> Be the last hero standing in the 7×7 arena by defeating your opponents.<br><br>
        <strong>Gameplay:</strong> Each turn, players can move, attack, defend, or use special abilities. Combat success is determined by dice rolls.<br><br>
        <strong>Heroes:</strong> Choose from Knights (strong and durable), Ninjas (fast and evasive), or Wizards (powerful ranged spellcasters).
      `,
      icon: 'info',
      confirmButtonText: 'Got it!',
      background: '#1f2937',
      color: '#d1d5db',
      confirmButtonColor: '#f59e0b'
    });
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const enterArenaBtn = document.getElementById('enter-arena');
  const chooseGameMode = document.querySelector('.choose-game-mode');
  const singleplayerBtn = document.querySelector('.singleplayer-btn');
  const multiplayerBtn = document.querySelector('.multiplayer-btn');

  // Initially hide the game mode selection
  chooseGameMode.style.display = 'none';

  enterArenaBtn.addEventListener('click', function () {
    // Show the game mode selection
    chooseGameMode.style.display = 'flex';
  });

  singleplayerBtn.addEventListener('click', function () {
    window.location.href = "/singleplayer/game.html";
  });

  multiplayerBtn.addEventListener('click', function () {
    window.location.href = "/multiplayer/game.html";
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const enterArenaBtn = document.getElementById('enter-home');

  enterArenaBtn.addEventListener('click', function () {
    window.location.href = "/index.html";
  });
});

function selectPlayers(num) {
  // Redirect to board.html with the number of players as a query parameter
  window.location.href = `/singleplayer/board.html?players=${num}`;
}

function selectMultiPlayers(num) {
  // Redirect to board.html with the number of players as a query parameter
  window.location.href = `/multiplayer/board.html?players=${num}`;
}