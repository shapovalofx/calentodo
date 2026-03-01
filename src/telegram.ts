// Telegram WebApp API типы и функции
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        onEvent: (eventType: string, callback: () => void) => void;
        offEvent: (eventType: string, callback: () => void) => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          setParams: (params: { text?: string; color?: string; textColor?: string }) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        CloudStorage: {
          setItem: (key: string, value: string, callback?: (error: Error | null) => void) => void;
          getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
          getItems: (keys: string[], callback: (error: Error | null, result: Record<string, string>) => void) => void;
          removeItem: (key: string, callback?: (error: Error | null) => void) => void;
          removeItems: (keys: string[], callback?: (error: Error | null) => void) => void;
          getKeys: (callback: (error: Error | null, keys: string[]) => void) => void;
        };
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          auth_date?: string;
          start_param?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        viewportStableHeight: number;
        colorScheme: 'light' | 'dark';
        isExpanded: boolean;
      };
    };
  }
}

export const TelegramAPI = {
  // Инициализация WebApp
  init: () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Применяем тему Telegram
      const theme = window.Telegram.WebApp.themeParams;
      if (theme.bg_color) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
      }
      if (theme.text_color) {
        document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
      }
      if (theme.hint_color) {
        document.documentElement.style.setProperty('--tg-theme-hint-color', theme.hint_color);
      }
      if (theme.link_color) {
        document.documentElement.style.setProperty('--tg-theme-link-color', theme.link_color);
      }
      if (theme.button_color) {
        document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color);
      }
      if (theme.button_text_color) {
        document.documentElement.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
      }
      
      return true;
    }
    return false;
  },

  // Получение данных пользователя
  getUser: () => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  },

  // Отправка данных в бот
  sendData: (data: any) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(JSON.stringify(data));
    }
  },

  // Управление главной кнопкой
  MainButton: {
    show: (text: string, onClick: () => void) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.text = text;
        window.Telegram.WebApp.MainButton.onClick(onClick);
        window.Telegram.WebApp.MainButton.show();
      }
    },
    hide: () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.hide();
      }
    },
    setText: (text: string) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.text = text;
      }
    },
    setParams: (params: { text?: string; color?: string; textColor?: string }) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setParams(params);
      }
    }
  },

  // Управление кнопкой "Назад"
  BackButton: {
    show: (onClick: () => void) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.BackButton.onClick(onClick);
        window.Telegram.WebApp.BackButton.show();
      }
    },
    hide: () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
  },

  // Тактильная обратная связь
  HapticFeedback: {
    impact: (style: 'light' | 'medium' | 'heavy' = 'light') => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
      }
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
      }
    },
    selection: () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    }
  },

  // Облачное хранилище
  CloudStorage: {
    setItem: (key: string, value: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.CloudStorage.setItem(key, value, (error) => {
            if (error) reject(error);
            else resolve();
          });
        } else {
          reject(new Error('Telegram WebApp not available'));
        }
      });
    },
    getItem: (key: string): Promise<string | null> => {
      return new Promise((resolve, reject) => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.CloudStorage.getItem(key, (error, value) => {
            if (error) reject(error);
            else resolve(value);
          });
        } else {
          reject(new Error('Telegram WebApp not available'));
        }
      });
    },
    getItems: (keys: string[]): Promise<Record<string, string>> => {
      return new Promise((resolve, reject) => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.CloudStorage.getItems(keys, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        } else {
          reject(new Error('Telegram WebApp not available'));
        }
      });
    },
    removeItem: (key: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.CloudStorage.removeItem(key, (error) => {
            if (error) reject(error);
            else resolve();
          });
        } else {
          reject(new Error('Telegram WebApp not available'));
        }
      });
    }
  }
};

export default TelegramAPI;
