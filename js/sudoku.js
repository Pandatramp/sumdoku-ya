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

  // Проверка: можно ли поставить num в ячейку
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

  // Решатель классического судоку
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
  countKillerSolutions(cages, puzzle, limit = 2) {
    const cageMap = new Array(81);
    cages.forEach(cage => {
      cage.cells.forEach(cell => {
        cageMap[cell.r * 9 + cell.c] = cage;
      });
    });

    const board = new Array(81).fill(0);
    // Копируем начальные значения из puzzle
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board[r * 9 + c] = puzzle[r][c];
      }
    }

    const count = { value: 0 };

    const solve = () => {
      if (count.value >= limit) return;

      let emptyIdx = -1;
      for (let i = 0; i < 81; i++) {
        if (board[i] === 0) { emptyIdx = i; break; }
      }
      if (emptyIdx === -1) {
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

      for (let num = 1; num <= 9; num++) {
        if (usedInCage.has(num)) continue;
        if (currentSum + num > cage.sum) continue;

        const minRemaining = emptyInCage > 1
          ? Array.from({ length: emptyInCage - 1 }, (_, i) => i + 1).reduce((a, b) => a + b, 0)
          : 0;
        if (currentSum + num + minRemaining > cage.sum) continue;

        const maxRemaining = emptyInCage > 1
          ? Array.from({ length: emptyInCage - 1 }, (_, i) => 9 - i).reduce((a, b) => a + b, 0)
          : 0;
        if (currentSum + num + maxRemaining < cage.sum) continue;

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
  generateCages(solution, rand) {
    const assigned = Array.from({ length: 9 }, () => Array(9).fill(-1));
    const cages = [];
    let cageId = 0;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const inBounds = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9;

    const unassigned = new Set();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) unassigned.add(r * 9 + c);

    // 🔹 Возвращаем старую формулу (без tinyChance)
    const targetSize = () => {
      const v = rand();
      if (v < 0.15) return 2;
      if (v < 0.55) return 3;
      if (v < 0.92) return 4;
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

  // 🔹 ГЛАВНАЯ ФУНКЦИЯ: генерация уровня с заполнением ячеек
  generatePuzzle(levelIndex) {
    const seed = levelIndex * 7919 + 104729;
    const rand = this.createSeededRandom(seed);

    // 🔹 Формула количества начальных цифр (плавное усложнение)
    // Уровень 1: 25 начальных цифр (очень легко)
    // Уровень 50: 8 начальных цифр (сложно)
    // Уровень 100+: 5 начальных цифр (эксперт)
    const targetFilled = Math.max(5, 25 - Math.floor(levelIndex / 3));

    const MAX_ATTEMPTS = 3;

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
      const cages = this.generateCages(solution, rand);

      // 3. 🔹 Заполняем начальные цифры
      const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
      const cells = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          cells.push({ r, c });
        }
      }
      // Перемешиваем ячейки
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }

      // Заполняем targetFilled ячеек
      for (let i = 0; i < Math.min(targetFilled, cells.length); i++) {
        const { r, c } = cells[i];
        puzzle[r][c] = solution[r][c];
      }

      // 4. 🔹 ПРОВЕРКА ЕДИНСТВЕННОСТИ РЕШЕНИЯ
      const solutionCount = this.countKillerSolutions(cages, puzzle, 2);

      if (solutionCount === 1) {
        // ✅ Единственное решение — возвращаем уровень
        return { puzzle, solution, cages };
      }

      // ⚠️ Не единственное — пробуем снова
      console.warn(`⚠️ Уровень ${levelIndex}, попытка ${attempt + 1}: решений ${solutionCount}`);
    }

    // 🔹 Фоллбэк: возвращаем последний вариант
    console.warn(`⚠️ Уровень ${levelIndex}: не удалось найти уникальное решение за ${MAX_ATTEMPTS} попыток`);
    
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
    const cages = this.generateCages(solution, rand);
    
    const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
    const cells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cells.push({ r, c });
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (let i = 0; i < Math.min(targetFilled, cells.length); i++) {
      const { r, c } = cells[i];
      puzzle[r][c] = solution[r][c];
    }
    
    return { puzzle, solution, cages };
  }
};