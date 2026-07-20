window.SudokuGen = {
  // Seeded PRNG (Mulberry32)
  createSeededRandom(seed) {
    let s = seed | 0;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },

  // Проверка: можно ли поставить num в ячейку (стандартные правила судоку)
  isValid(board, row, col, num) {
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num) return false;
      if (board[x][col] === num) return false;
    }
    const startX = Math.floor(col / 3) * 3;
    const startY = Math.floor(row / 3) * 3;
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (board[startY + y][startX + x] === num) return false;
      }
    }
    return true;
  },

  // Решатель классического судоку (для генерации полного решения)
  solve(board, rand) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          if (rand) {
            for (let i = nums.length - 1; i > 0; i--) {
              const j = Math.floor(rand() * (i + 1));
              [nums[i], nums[j]] = [nums[j], nums[i]];
            }
          }
          for (const num of nums) {
            if (this.isValid(board, row, col, num)) {
              board[row][col] = num;
              if (this.solve(board, rand)) return true;
              board[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  },

  // 🔹 РЕШАТЕЛЬ KILLER SUDOKU — считает количество решений
  // Учитывает: строки, столбцы, блоки 3×3, суммы клеток, уникальность в клетках
  countKillerSolutions(cages, limit = 2) {
    // Подготовка: карта "ячейка → клетка"
    const cageMap = new Array(81);
    cages.forEach(cage => {
      cage.cells.forEach(cell => {
        cageMap[cell.r * 9 + cell.c] = cage;
      });
    });

    // Доска: 81 ячейка, 0 = пусто
    const board = new Array(81).fill(0);
    const count = { value: 0 };

    // 🔹 Рекурсивный решатель с отсечениями
    const solve = () => {
      if (count.value >= limit) return;

      // Находим первую пустую ячейку
      let emptyIdx = -1;
      for (let i = 0; i < 81; i++) {
        if (board[i] === 0) { emptyIdx = i; break; }
      }
      if (emptyIdx === -1) {
        // Все ячейки заполнены — проверяем суммы
        let valid = true;
        for (const cage of cages) {
          let sum = 0;
          for (const cell of cage.cells) {
            sum += board[cell.r * 9 + cell.c];
          }
          if (sum !== cage.sum) { valid = false; break; }
        }
        if (valid) count.value++;
        return;
      }

      const r = Math.floor(emptyIdx / 9);
      const c = emptyIdx % 9;
      const cage = cageMap[emptyIdx];

      // 🔹 Считаем текущее состояние клетки
      let currentSum = 0;
      let emptyInCage = 0;
      const usedInCage = new Set();
      for (const cell of cage.cells) {
        const idx = cell.r * 9 + cell.c;
        if (board[idx] !== 0) {
          currentSum += board[idx];
          usedInCage.add(board[idx]);
        } else {
          emptyInCage++;
        }
      }

      // 🔹 Перебираем цифры 1-9
      for (let num = 1; num <= 9; num++) {
        // Отсечение 1: цифра не должна повторяться в клетке
        if (usedInCage.has(num)) continue;

        // Отсечение 2: сумма не должна превышать target
        if (currentSum + num > cage.sum) continue;

        // Отсечение 3: минимально возможные оставшиеся цифры
        const minRemaining = emptyInCage > 1
          ? Array.from({ length: emptyInCage - 1 }, (_, i) => i + 1).reduce((a, b) => a + b, 0)
          : 0;
        if (currentSum + num + minRemaining > cage.sum) continue;

        // Отсечение 4: максимально возможные оставшиеся цифры
        const maxRemaining = emptyInCage > 1
          ? Array.from({ length: emptyInCage - 1 }, (_, i) => 9 - i).reduce((a, b) => a + b, 0)
          : 0;
        if (currentSum + num + maxRemaining < cage.sum) continue;

        // Отсечение 5: стандартные правила судоку
        if (!this.isValid(board, r, c, num)) continue;

        board[emptyIdx] = num;
        solve();
        board[emptyIdx] = 0;

        if (count.value >= limit) return;
      }
    };

    solve();
    return count.value;
  },

  // 🔹 Генерация клеток (cages) — region-growing
  generateCages(solution, rand, levelIndex) {
    const assigned = Array.from({ length: 9 }, () => Array(9).fill(-1));
    const cages = [];
    let cageId = 0;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const inBounds = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9;

    const unassigned = new Set();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) unassigned.add(r * 9 + c);

    // 🔹 Плавный рост сложности: чем выше уровень — тем больше клетки
        // 🔹 Плавный рост сложности: чем выше уровень — тем больше клетки
    const difficultyFactor = Math.min(1, levelIndex / 50);
    const smallChance = 0.30 - difficultyFactor * 0.15;   // 🔹 30% → 15% (было 15% → 5%)
    const mediumChance = 0.45;                             // 🔹 45% (было 40%)
    const largeChance = 0.20 + difficultyFactor * 0.15;    // 🔹 20% → 35% (было 37% → 47%)
    const hugeChance = 0.05 + difficultyFactor * 0.05;     // 🔹 5% → 10% (было 8% → 16%)

    const targetSize = () => {
      const v = rand();
      if (v < smallChance) return 2;
      if (v < smallChance + mediumChance) return 3;
      if (v < smallChance + mediumChance + largeChance) return 4;
      return 5;
    };

    while (unassigned.size > 0) {
      const arr = Array.from(unassigned);
      const seedKey = arr[Math.floor(rand() * arr.length)];
      const seedR = Math.floor(seedKey / 9);
      const seedC = seedKey % 9;

      const cage = [{ r: seedR, c: seedC }];
      assigned[seedR][seedC] = cageId;
      unassigned.delete(seedKey);

      const target = targetSize();
      let attempts = 0;

      while (cage.length < target && attempts < 60) {
        attempts++;
        const neighbors = [];
        const seen = new Set();
        for (const cell of cage) {
          for (const [dr, dc] of dirs) {
            const nr = cell.r + dr, nc = cell.c + dc;
            if (inBounds(nr, nc) && assigned[nr][nc] === -1) {
              const key = nr * 9 + nc;
              if (!seen.has(key)) { seen.add(key); neighbors.push({ r: nr, c: nc }); }
            }
          }
        }
        if (neighbors.length === 0) break;

        for (let i = neighbors.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }

        let added = false;
        for (const n of neighbors) {
          const digit = solution[n.r][n.c];
          const hasDuplicate = cage.some(c => solution[c.r][c.c] === digit);
          if (!hasDuplicate) {
            cage.push(n);
            assigned[n.r][n.c] = cageId;
            unassigned.delete(n.r * 9 + n.c);
            added = true;
            break;
          }
        }
        if (!added) break;
      }

      cages.push({
        id: cageId,
        cells: cage,
        sum: cage.reduce((s, c) => s + solution[c.r][c.c], 0)
      });
      cageId++;
    }

    return cages;
  },

  // 🔹 ГЛАВНАЯ ФУНКЦИЯ: генерация уровня с проверкой единственности
  generatePuzzle(levelIndex) {
    const seed = levelIndex * 7919 + 104729;
    const rand = this.createSeededRandom(seed);

    // 🔹 Максимум попыток для поиска уникального уровня
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // 1. Генерируем полное валидное решение
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let i = 0; i < 9; i += 3) {
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const idx = Math.floor(rand() * nums.length);
            board[i + r][i + c] = nums.splice(idx, 1)[0];
          }
        }
      }
      this.solve(board, rand);
      const solution = board.map(row => [...row]);

      // 2. Генерируем клетки (cages)
      const cages = this.generateCages(solution, rand, levelIndex);

      // 3. 🔹 ПРОВЕРКА ЕДИНСТВЕННОСТИ РЕШЕНИЯ
      const solutionCount = this.countKillerSolutions(cages, 2);

      if (solutionCount === 1) {
        // ✅ Единственное решение — возвращаем уровень
        const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
        return { puzzle, solution, cages };
      }

      // ⚠️ Не единственное — пробуем снова
      console.warn(`⚠️ Уровень ${levelIndex}, попытка ${attempt + 1}: решений ${solutionCount}`);
    }

    // 🔹 Если не удалось за MAX_ATTEMPTS — возвращаем последний вариант с предупреждением
    console.warn(`⚠️ Уровень ${levelIndex}: не удалось найти уникальное решение за ${MAX_ATTEMPTS} попыток`);
    
    // Фоллбэк: генерируем без проверки
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let i = 0; i < 9; i += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const idx = Math.floor(rand() * nums.length);
          board[i + r][i + c] = nums.splice(idx, 1)[0];
        }
      }
    }
    this.solve(board, rand);
    const solution = board.map(row => [...row]);
    const cages = this.generateCages(solution, rand, levelIndex);
    const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
    return { puzzle, solution, cages };
  }
};