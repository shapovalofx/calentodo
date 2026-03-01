# 🚀 Настройка Calentodobot как Telegram WebApp

## 📋 Что такое Telegram WebApp?

Telegram WebApp - это веб-приложения, которые работают внутри Telegram. Как кошелек Telegram или другие мини-приложения.

## 🎯 Преимущества WebApp:

✅ **Работает внутри Telegram** - не нужно离开 приложение  
✅ **Автоматическая авторизация** - через Telegram аккаунт  
✅ **Облачное хранилище** - данные синхронизируются  
✅ **Тактильная обратная связь** - виброотклик  
✅ **Адаптивный дизайн** - под тему Telegram  
✅ **Главная кнопка** - для быстрых действий  

---

## 🛠️ Шаг 1: Создание бота

1. Найди **@BotFather** в Telegram
2. Отправь команду `/newbot`
3. Дай имя боту: `Calentodobot WebApp`
4. Дай username: `calentodobot_bot` (или другой)
5. **Сохрани токен** - он понадобится позже

---

## 🌐 Шаг 2: Настройка WebApp

1. Отправь @BotFather команду `/mybots`
2. Выбери своего бота
3. Нажми **"Bot Settings"** → **"Menu Button"**
4. Включи меню кнопки

---

## 📱 Шаг 3: Размещение приложения

### Вариант А: GitHub Pages (рекомендуется)

1. **Загрузи проект на GitHub**
2. Включи **GitHub Pages** в настройках репозитория
3. Твой сайт будет доступен по адресу:  
   `https://[username].github.io/Calentodobot/`

### Вариант Б: Vercel/Netlify

1. Зайди на [Vercel](https://vercel.com) или [Netlify](https://netlify.com)
2. Подключи GitHub репозиторий
3. Получи ссылку на deployed приложение

### Вариант В: Собственный сервер

```bash
# Установи Node.js
npm install -g serve

# Запуск локально
serve -s build -l 3000

# Или с помощью nginx/apache
```

---

## 🔗 Шаг 4: Настройка бота для WebApp

1. Отправь @BotFather команду `/setdomain`
2. Выбери своего бота
3. Введи домен твоего приложения:
   ```
   [username].github.io
   ```

4. Для **localhost** тестирования:
   ```
   /setdomain
   calentodobot_bot
   localhost:3000
   ```

---

## 📝 Шаг 5: Создание команды для запуска

1. Отправь @BotFather `/setcommands`
2. Выбери бота
3. Введи команды:
   ```
   start - Запустить Calentodobot 📅
   help - Помощь 🆘
   calendar - Открыть календарь 📋
   ```

---

## 🎮 Шаг 6: Тестирование

### В Telegram:
1. Найди своего бота
2. Нажми **"Запустить"** или отправь `/start`
3. Бот покажет кнопку **"Открыть приложение"**
4. Нажми на кнопку - откроется WebApp

### Проверка функций:
- ✅ Календарь работает
- ✅ Задачи добавляются  
- ✅ Эмодзи выбираются
- ✅ Данные сохраняются
- ✅ Виброотлик есть

---

## 🛠️ Файлы проекта:

```
Calentodobot/
├── src/
│   ├── App.tsx          # Основное приложение
│   ├── telegram.ts      # Telegram API
│   └── index.css        # Стили
├── telegram.html        # Входная точка WebApp
├── TELEGRAM_SETUP.md    # Этот файл
└── package.json         # Зависимости
```

---

## 🔧 Настройка переменных:

В `src/App.tsx` уже всё настроено:

```typescript
// Автоматическое определение Telegram
const telegramInit = TelegramAPI.init();
setIsTelegram(telegramInit);

// Использование CloudStorage в Telegram
if (isTelegram) {
  await TelegramAPI.CloudStorage.setItem(key, value);
} else {
  localStorage.setItem(key, value);
}
```

---

## 📊 Особенности реализации:

### 🎨 **Адаптивный дизайн:**
```css
background-color: var(--tg-theme-bg-color);
color: var(--tg-theme-text-color);
```

### 💾 **Два режима хранения:**
- **Telegram:** CloudStorage
- **Браузер:** localStorage

### 📳 **Тактильная обратная связь:**
```typescript
TelegramAPI.HapticFeedback.notification('success');
```

### 🔘 **Главная кнопка:**
```typescript
TelegramAPI.MainButton.setText('Сохранить');
TelegramAPI.MainButton.show();
```

---

## 🚨 Распространенные проблемы:

### ❌ **"WebApp не открывается"**
- Проверь домен в `/setdomain`
- Убедись что HTTPS работает
- Проверь console.log в браузере

### ❌ **"Данные не сохраняются"**  
- Проверь права CloudStorage
- Попробуй очистить кэш Telegram

### ❌ **"Виброотлик не работает"**
- Убедись что телефон поддерживает вибрацию
- Проверь настройки Telegram

---

## 🎉 Готово!

Твой Calentodobot теперь работает как Telegram WebApp! 🚀

**Пользователи могут:**
- Открыть прямо из Telegram
- Использовать все функции календаря  
- Получать виброотклик
- Синхронизировать данные

**Ссылка для пользователей:**
`t.me/[твой_bot]/start`
