(function() {
  // 获取DOM元素
  const refreshGamesBtn = document.getElementById('refresh-games-btn');
  const createGameBtn = document.getElementById('create-game-btn');
  const gameGrid = document.getElementById('game-grid');
  const gameDetails = document.getElementById('game-details');
  const createGameModal = document.getElementById('create-game-modal');
  const closeModal = document.querySelector('.close-modal');
  const cancelCreateGame = document.getElementById('cancel-create-game');
  const confirmCreateGame = document.getElementById('confirm-create-game');
  const gameName = document.getElementById('game-name');
  const gameDescription = document.getElementById('game-description');
  const gameType = document.getElementById('game-type');
  const gameDifficulty = document.getElementById('game-difficulty');
  const difficultyValue = document.getElementById('difficulty-value');

  // 玩法列表
  let games = [];
  let selectedGameId = null;

  // 玩法类型映射
  const gameTypeMap = {
    'puzzle': '益智类',
    'action': '动作类',
    'strategy': '策略类',
    'simulation': '模拟类',
    'other': '其他'
  };

  // 难度级别映射
  const difficultyMap = {
    1: '简单',
    2: '较简单',
    3: '中等',
    4: '较难',
    5: '困难'
  };

  // 初始化玩法列表
  function initGameList() {
    // 从本地存储加载玩法列表
    const savedGames = localStorage.getItem('games');
    if (savedGames) {
      try {
        games = JSON.parse(savedGames);
        updateGameList();
      } catch (error) {
        console.error('加载玩法列表失败:', error);
      }
    }
  }

  // 保存玩法列表到本地存储
  function saveGames() {
    try {
      localStorage.setItem('games', JSON.stringify(games));
    } catch (error) {
      console.error('保存玩法列表失败:', error);
    }
  }

  // 更新玩法列表UI
  function updateGameList() {
    // 清空玩法网格
    gameGrid.innerHTML = '';

    if (games.length === 0) {
      // 如果没有玩法，显示空提示
      const emptyGames = document.createElement('div');
      emptyGames.className = 'empty-games';
      emptyGames.textContent = '暂无玩法，请创建新玩法或刷新列表';
      gameGrid.appendChild(emptyGames);
      return;
    }

    // 添加玩法到网格
    games.forEach(game => {
      const gameCard = document.createElement('div');
      gameCard.className = 'game-card';
      gameCard.dataset.gameId = game.id;
      
      if (game.id === selectedGameId) {
        gameCard.classList.add('selected-game');
      }

      // 生成随机颜色作为卡片背景
      const randomColor = getRandomColor(game.id);

      gameCard.innerHTML = `
        <div class="game-card-header" style="background-color: ${randomColor}">
          <h4>${game.name}</h4>
          <span class="game-type-badge">${gameTypeMap[game.type] || game.type}</span>
        </div>
        <div class="game-card-body">
          <p class="game-description">${game.description.substring(0, 60)}${game.description.length > 60 ? '...' : ''}</p>
          <div class="game-difficulty">
            <span>难度:</span>
            <div class="difficulty-bar">
              ${generateDifficultyBar(game.difficulty)}
            </div>
            <span>${difficultyMap[game.difficulty]}</span>
          </div>
        </div>
        <div class="game-card-footer">
          <button class="action-btn view-btn" data-action="view" data-game-id="${game.id}">查看</button>
          <button class="action-btn edit-btn" data-action="edit" data-game-id="${game.id}">编辑</button>
          <button class="action-btn delete-btn" data-action="delete" data-game-id="${game.id}">删除</button>
        </div>
      `;

      gameGrid.appendChild(gameCard);
    });

    // 添加事件监听
    const actionButtons = gameGrid.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
      button.addEventListener('click', handleGameAction);
    });

    // 添加卡片点击事件
    const gameCards = gameGrid.querySelectorAll('.game-card');
    gameCards.forEach(card => {
      card.addEventListener('click', (event) => {
        // 如果点击的是按钮，不触发卡片点击事件
        if (event.target.tagName === 'BUTTON') return;
        
        const gameId = card.dataset.gameId;
        selectGame(gameId);
      });
    });
  }

  // 生成难度条
  function generateDifficultyBar(difficulty) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const active = i <= difficulty ? 'active' : '';
      html += `<div class="difficulty-dot ${active}"></div>`;
    }
    return html;
  }

  // 根据ID生成随机颜色
  function getRandomColor(id) {
    // 使用ID作为种子生成一致的颜色
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = seed % 360;
    return `hsl(${hue}, 70%, 80%)`;
  }

  // 处理玩法操作
  function handleGameAction(event) {
    const action = event.target.dataset.action;
    const gameId = event.target.dataset.gameId;
    const game = games.find(g => g.id === gameId);

    if (!game) return;

    switch (action) {
      case 'view':
        selectGame(gameId);
        break;
      case 'edit':
        editGame(game);
        break;
      case 'delete':
        deleteGame(gameId);
        break;
    }

    // 阻止事件冒泡，防止触发卡片点击事件
    event.stopPropagation();
  }

  // 选择玩法并显示详情
  function selectGame(gameId) {
    selectedGameId = gameId;
    const game = games.find(g => g.id === gameId);

    if (!game) {
      gameDetails.innerHTML = '<p class="empty-details">玩法不存在</p>';
      return;
    }

    // 更新卡片选中状态
    const gameCards = gameGrid.querySelectorAll('.game-card');
    gameCards.forEach(card => {
      if (card.dataset.gameId === gameId) {
        card.classList.add('selected-game');
      } else {
        card.classList.remove('selected-game');
      }
    });

    // 更新玩法详情
    const randomColor = getRandomColor(game.id);
    
    gameDetails.innerHTML = `
      <div class="game-detail-header" style="background-color: ${randomColor}">
        <h3>${game.name}</h3>
        <span class="game-type-badge">${gameTypeMap[game.type] || game.type}</span>
      </div>
      <div class="game-detail-info">
        <p><strong>描述:</strong> ${game.description}</p>
        <p><strong>难度:</strong> ${difficultyMap[game.difficulty]}</p>
        <div class="difficulty-display">
          <div class="difficulty-bar large">
            ${generateDifficultyBar(game.difficulty)}
          </div>
        </div>
        <p><strong>创建时间:</strong> ${new Date(game.createdAt).toLocaleString()}</p>
        <p><strong>最后修改:</strong> ${game.updatedAt ? new Date(game.updatedAt).toLocaleString() : '从未修改'}</p>
      </div>
      <div class="game-detail-actions">
        <button class="primary-btn" id="play-game-btn">开始玩法</button>
        <button class="secondary-btn" id="edit-game-btn">编辑玩法</button>
        <button class="danger-btn" id="delete-game-btn">删除玩法</button>
      </div>
    `;

    // 添加按钮事件
    const playBtn = document.getElementById('play-game-btn');
    const editBtn = document.getElementById('edit-game-btn');
    const deleteBtn = document.getElementById('delete-game-btn');

    if (playBtn) {
      playBtn.addEventListener('click', () => playGame(game.id));
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => editGame(game));
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteGame(game.id));
    }
  }

  // 开始玩法
  function playGame(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    alert(`开始玩法: ${game.name}\n此功能尚未实现`);
  }

  // 创建玩法
  function createGame() {
    const name = gameName.value.trim();
    const description = gameDescription.value.trim();
    const type = gameType.value;
    const difficulty = parseInt(gameDifficulty.value, 10);

    if (!name || !description) {
      alert('玩法名称和描述不能为空');
      return;
    }

    // 生成唯一ID
    const id = 'game_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    // 创建新玩法
    const newGame = {
      id,
      name,
      description,
      type,
      difficulty,
      createdAt: Date.now(),
      updatedAt: null
    };

    // 添加到玩法列表
    games.push(newGame);
    saveGames();
    updateGameList();
    closeCreateGameModal();

    // 选中新添加的玩法
    selectGame(id);
  }

  // 编辑玩法
  function editGame(game) {
    // 填充表单
    gameName.value = game.name;
    gameDescription.value = game.description;
    gameType.value = game.type;
    gameDifficulty.value = game.difficulty;
    updateDifficultyValue();

    // 打开模态框
    createGameModal.style.display = 'block';

    // 修改确认按钮文本
    confirmCreateGame.textContent = '确认修改';

    // 修改确认按钮事件
    confirmCreateGame.onclick = function() {
      // 更新玩法信息
      const updatedGame = games.find(g => g.id === game.id);
      if (updatedGame) {
        updatedGame.name = gameName.value.trim();
        updatedGame.description = gameDescription.value.trim();
        updatedGame.type = gameType.value;
        updatedGame.difficulty = parseInt(gameDifficulty.value, 10);
        updatedGame.updatedAt = Date.now();
        saveGames();
        updateGameList();
        selectGame(game.id);
      }
      closeCreateGameModal();
    };
  }

  // 删除玩法
  function deleteGame(gameId) {
    if (!confirm('确定要删除此玩法吗？')) return;

    // 从玩法列表中移除
    games = games.filter(g => g.id !== gameId);
    saveGames();
    updateGameList();

    // 如果删除的是当前选中的玩法，清空详情
    if (selectedGameId === gameId) {
      selectedGameId = null;
      gameDetails.innerHTML = '<p class="empty-details">请选择一个玩法查看详情</p>';
    }
  }

  // 打开创建玩法模态框
  function openCreateGameModal() {
    // 重置表单
    gameName.value = '';
    gameDescription.value = '';
    gameType.value = 'puzzle';
    gameDifficulty.value = 3;
    updateDifficultyValue();

    // 重置确认按钮
    confirmCreateGame.textContent = '确认创建';
    confirmCreateGame.onclick = createGame;

    // 显示模态框
    createGameModal.style.display = 'block';
  }

  // 关闭创建玩法模态框
  function closeCreateGameModal() {
    createGameModal.style.display = 'none';
  }

  // 更新难度值显示
  function updateDifficultyValue() {
    const difficulty = parseInt(gameDifficulty.value, 10);
    difficultyValue.textContent = difficultyMap[difficulty] || '中等';
  }

  // 刷新玩法列表
  function refreshGames() {
    // 模拟刷新玩法列表
    // 在实际应用中，这里应该从服务器或本地服务获取玩法列表
    updateGameList();
  }

  // 事件监听
  refreshGamesBtn.addEventListener('click', refreshGames);
  createGameBtn.addEventListener('click', openCreateGameModal);
  closeModal.addEventListener('click', closeCreateGameModal);
  cancelCreateGame.addEventListener('click', closeCreateGameModal);

  // 难度滑块事件
  if (gameDifficulty) {
    gameDifficulty.addEventListener('input', updateDifficultyValue);
  }

  // 点击模态框外部关闭模态框
  window.addEventListener('click', (event) => {
    if (event.target === createGameModal) {
      closeCreateGameModal();
    }
  });

  // 初始化
  function init() {
    initGameList();
    console.log('玩法列表页面已加载');
  }

  // 页面加载完成后初始化
  window.addEventListener('load', init);

  // 将初始化函数暴露到全局作用域，以便 index.html 可以调用它
  window.initGameList = init;
})();