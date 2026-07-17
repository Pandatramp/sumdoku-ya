window.SudokuGen = {
  // Seeded PRNG (Mulberry32) — для одинаковых уровней у всех игроков
  createSeededRandom(seed) {
    let s = seed | 0;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },

  // Проверка: можно ли поставить num в ячейку (row, col)
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

  // Решатель судоку (бэктрекинг)
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

  // 🔹 НОВОЕ: генерация клеток (cages) для Killer Sudoku
  generateCages(solution, rand) {
    const assigned = Array.from({ length: 9 }, () => Array(9).fill(-1));
    const cages = [];
    let cageId = 0;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const inBounds = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9;

    const unassigned = new Set();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) unassigned.add(r * 9 + c);

    // Целевой размер клетки: 2–4 (редко 5)
    const targetSize = () => {
      const v = rand();
      if (v < 0.15) return 2;
      if (v < 0.55) return 3;
      if (v < 0.92) return 4;
      return 5;
    };

    while (unassigned.size > 0) {
      // Выбираем случайную свободную ячейку как "seed"
      const arr = Array.from(unassigned);
      const seedKey = arr[Math.floor(rand() * arr.length)];
      const seedR = Math.floor(seedKey / 9);
      const seedC = seedKey % 9;

      const cage = [{ r: seedR, c: seedC }];
      assigned[seedR][seedC] = cageId;
      unassigned.delete(seedKey);

      const target = targetSize();
      let attempts = 0;

      // Расширяем клетку, добавляя соседей без дубликатов цифр
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

        // Перемешиваем соседей
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

  // 🔹 Генерация уровня Killer Sudoku
  generatePuzzle(levelIndex) {
    const seed = levelIndex * 7919 + 104729;
    const rand = this.createSeededRandom(seed);

    const board = Array.from({ length: 9 }, () => Array(9).fill(0));

    // Заполнение диагональных блоков 3×3 (они независимы)
    for (let i = 0; i < 9; i += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const idx = Math.floor(rand() * nums.length);
          board[i + r][i + c] = nums.splice(idx, 1)[0];
        }
      }
    }

    // Достраиваем полное валидное решение
    this.solve(board, rand);
    const solution = board.map(row => [...row]);

    // Генерируем клетки (cages)
    const cages = this.generateCages(solution, rand);

    // В Killer Sudoku поле изначально пустое — все нули
    const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));

    return { puzzle, solution, cages };
  }
};