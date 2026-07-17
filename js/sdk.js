window.YandexSDK = {
  sdk: null,
  player: null,
  lastInterstitial: 0,

  async init() {
    try {
      this.sdk = await YaGames.init();
      try {
        this.player = await this.sdk.getPlayer({ scopes: false });
        await this.syncCloud();
      } catch (e) {
        console.warn('Не удалось получить игрока:', e);
      }
    } catch (e) {
      console.warn('SDK не инициализирован (локальный режим):', e);
    }
  },

  async syncCloud() {
    if (!this.player) return;
    const data = await this.player.getData();
    if (data.level) Game.state.level = data.level;
  },

  async saveProgress() {
    if (this.player) {
      await this.player.setData({ level: Game.state.level });
    }
  },

  showInterstitial() {
    const now = Date.now();
    if (now - this.lastInterstitial < 60000) return; // Не чаще 1 раза в минуту
    this.lastInterstitial = now;
    if (this.sdk?.adv) {
      this.sdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => console.log('Интерстишиал закрыт'),
          onError: () => console.warn('Ошибка интерстишиала')
        }
      });
    }
  },

  showRewardedHint() {
    if (this.sdk?.adv) {
      this.sdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => console.log('Реворд открыт'),
          onRewarded: () => {
            console.log('Награда получена!');
            Game.useHint(); // Вызываем подсказку после рекламы
          },
          onClose: () => console.log('Реворд закрыт'),
          onError: () => console.warn('Ошибка реворда')
        }
      });
    }
  },

  checkRewardedReady() {
    return true; // Упрощено для MVP
  },

  updateLeaderboard(time) {
    if (this.sdk?.getLeaderboards) {
      this.sdk.getLeaderboards().then(lb => {
        lb.setLeaderboardScore('time', time).catch(() => {});
      }).catch(() => {});
    }
  }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => YandexSDK.init());