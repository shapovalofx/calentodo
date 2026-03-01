import React, { useEffect, useMemo, useState } from 'react';
import TelegramAPI from './telegram';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  isImportant: boolean;
  time?: string;
  dueDate?: string;
  deadline?: string;
  alarm?: string;
  note?: string;
  children: Task[];
  level: number;
  collapsed?: boolean;
}

type TasksByDate = Record<string, Task[]>;
type EmojisByDate = Record<string, string>;

const STORAGE_KEY = 'calentodobot.calendar.tasks';
const TEMPLATE_KEY = 'calentodobot.calendar.template';
const EMOJI_KEY = 'calentodobot.calendar.emojis';
const MAX_LEVEL = 5;

const WEEK_DAYS = ['1', '2', '3', '4', '5', '6', '7'];

// Функция преобразования года в римские цифры
function toRoman(num: number): string {
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];
  
  let result = '';
  for (const { value, numeral } of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const utc = new Date(Date.UTC(year, month, day));
  return utc.toISOString().slice(0, 10);
}

function isoFromYMD(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month, day));
  return utc.toISOString().slice(0, 10);
}

function formatDateForDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatMonth(year: number, month: number): string {
  return `${toRoman(month + 1)}`;
}

function createTask(text: string, level: number): Task {
  return {
    id: `${Date.now()}-${Math.random()}`,
    text,
    completed: false,
    isImportant: false,
    children: [],
    level
  };
}

function normalizeTask(raw: any, level = 1): Task {
  const currentLevel = Math.min(level, MAX_LEVEL);
  const childrenRaw = Array.isArray(raw?.children) ? raw.children : [];

  return {
    id: String(raw?.id ?? `${Date.now()}-${Math.random()}`),
    text: String(raw?.text ?? ''),
    completed: Boolean(raw?.completed),
    isImportant: Boolean(raw?.isImportant),
    time: typeof raw?.time === 'string' ? raw.time : undefined,
    dueDate: typeof raw?.dueDate === 'string' ? raw.dueDate : undefined,
    deadline: typeof raw?.deadline === 'string' ? raw.deadline : undefined,
    alarm: typeof raw?.alarm === 'string' ? raw.alarm : undefined,
    note: typeof raw?.note === 'string' ? raw.note : undefined,
    collapsed: Boolean(raw?.collapsed),
    children:
      currentLevel < MAX_LEVEL
        ? childrenRaw.map((child: any) => normalizeTask(child, currentLevel + 1))
        : [],
    level: currentLevel
  };
}

function cloneTask(task: Task, level = 1): Task {
  const currentLevel = Math.min(level, MAX_LEVEL);
  return {
    id: `${Date.now()}-${Math.random()}`,
    text: task.text,
    completed: false,
    isImportant: task.isImportant,
    time: task.time,
    dueDate: task.dueDate,
    deadline: task.deadline,
    alarm: task.alarm,
    note: task.note,
    collapsed: task.collapsed,
    children:
      currentLevel < MAX_LEVEL
        ? task.children.map((child) => cloneTask(child, currentLevel + 1))
        : [],
    level: currentLevel
  };
}

function updateTaskInTree(
  list: Task[],
  id: string,
  updater: (task: Task) => Task
): Task[] {
  let changed = false;
  const result = list.map((task) => {
    let nextTask = task;
    if (task.id === id) {
      nextTask = updater(task);
      changed = true;
    }
    const newChildren = updateTaskInTree(task.children, id, updater);
    if (newChildren !== task.children) {
      nextTask = { ...nextTask, children: newChildren };
      changed = true;
    }
    return nextTask;
  });
  return changed ? result : list;
}

function deleteTaskFromTree(list: Task[], id: string): Task[] {
  let changed = false;
  const result: Task[] = [];

  for (const task of list) {
    if (task.id === id) {
      changed = true;
      continue;
    }
    const newChildren = deleteTaskFromTree(task.children, id);
    if (newChildren !== task.children) {
      result.push({ ...task, children: newChildren });
      changed = true;
    } else {
      result.push(task);
    }
  }

  return changed ? result : list;
}

function addSubtaskToTree(list: Task[], parentId: string, text: string): Task[] {
  return list.map((task) => {
    if (task.id === parentId) {
      if (task.level >= MAX_LEVEL) {
        return task;
      }
      const child = createTask(text, task.level + 1);
      return { ...task, children: [child, ...task.children] };
    }
    const newChildren = addSubtaskToTree(task.children, parentId, text);
    if (newChildren !== task.children) {
      return { ...task, children: newChildren };
    }
    return task;
  });
}

const App: React.FC = () => {
  const [tasksByDate, setTasksByDate] = useState<TasksByDate>({});
  const [emojisByDate, setEmojisByDate] = useState<EmojisByDate>({});
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [newTaskText, setNewTaskText] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState(false);
  const [templateNewTaskText, setTemplateNewTaskText] = useState('');
  const [lastTemplateApply, setLastTemplateApply] = useState<{
    date: string;
    prevTasks: Task[];
  } | null>(null);

  const [calendar, setCalendar] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [templateTasks, setTemplateTasks] = useState<Task[]>([]);
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [subText, setSubText] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);

  // Инициализация Telegram WebApp
  useEffect(() => {
    const telegramInit = TelegramAPI.init();
    setIsTelegram(telegramInit);
    
    if (telegramInit) {
      const user = TelegramAPI.getUser();
      console.log('Telegram user:', user);
      TelegramAPI.HapticFeedback.impact('light');
    }
  }, []);

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isTelegram) {
          // Используем Telegram CloudStorage
          const tasksData = await TelegramAPI.CloudStorage.getItem(STORAGE_KEY);
          if (tasksData) {
            const parsed = JSON.parse(tasksData);
            if (parsed && typeof parsed === 'object') {
              const result: TasksByDate = {};
              Object.entries(parsed as Record<string, unknown>).forEach(([date, value]) => {
                if (Array.isArray(value)) {
                  result[date] = value.map((t: any) => normalizeTask(t, 1));
                }
              });
              setTasksByDate(result);
            }
          }

          const emojisData = await TelegramAPI.CloudStorage.getItem(EMOJI_KEY);
          if (emojisData) {
            const parsed = JSON.parse(emojisData);
            if (parsed && typeof parsed === 'object') {
              setEmojisByDate(parsed as EmojisByDate);
            }
          }

          const templateData = await TelegramAPI.CloudStorage.getItem(TEMPLATE_KEY);
          if (templateData) {
            const parsed = JSON.parse(templateData);
            if (Array.isArray(parsed)) {
              setTemplateTasks(parsed.map((t: any) => normalizeTask(t, 1)));
            }
          }
        } else {
          // Используем localStorage
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              const result: TasksByDate = {};
              Object.entries(parsed as Record<string, unknown>).forEach(([date, value]) => {
                if (Array.isArray(value)) {
                  result[date] = value.map((t: any) => normalizeTask(t, 1));
                }
              });
              setTasksByDate(result);
            }
          }

          const rawEmojis = window.localStorage.getItem(EMOJI_KEY);
          if (rawEmojis) {
            const parsed = JSON.parse(rawEmojis);
            if (parsed && typeof parsed === 'object') {
              setEmojisByDate(parsed as EmojisByDate);
            }
          }

          const rawTemplate = window.localStorage.getItem(TEMPLATE_KEY);
          if (rawTemplate) {
            const parsed = JSON.parse(rawTemplate);
            if (Array.isArray(parsed)) {
              setTemplateTasks(parsed.map((t: any) => normalizeTask(t, 1)));
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    if (isTelegram !== null) {
      loadData();
    }
  }, [isTelegram]);

  useEffect(() => {
    const saveData = async () => {
      try {
        if (isTelegram) {
          // Используем Telegram CloudStorage
          await TelegramAPI.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
        } else {
          // Используем localStorage
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
        }
      } catch (error) {
        console.error('Error saving tasks:', error);
      }
    };

    if (isTelegram !== null) {
      saveData();
    }
  }, [tasksByDate, isTelegram]);

  useEffect(() => {
    const saveData = async () => {
      try {
        if (isTelegram) {
          // Используем Telegram CloudStorage
          await TelegramAPI.CloudStorage.setItem(EMOJI_KEY, JSON.stringify(emojisByDate));
        } else {
          // Используем localStorage
          window.localStorage.setItem(EMOJI_KEY, JSON.stringify(emojisByDate));
        }
      } catch (error) {
        console.error('Error saving emojis:', error);
      }
    };

    if (isTelegram !== null) {
      saveData();
    }
  }, [emojisByDate, isTelegram]);

  useEffect(() => {
    const saveData = async () => {
      try {
        if (isTelegram) {
          // Используем Telegram CloudStorage
          await TelegramAPI.CloudStorage.setItem(TEMPLATE_KEY, JSON.stringify(templateTasks));
        } else {
          // Используем localStorage
          window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templateTasks));
        }
      } catch (error) {
        console.error('Error saving templates:', error);
      }
    };

    if (isTelegram !== null) {
      saveData();
    }
  }, [templateTasks, isTelegram]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEMPLATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setTemplateTasks(parsed.map((t: any) => normalizeTask(t, 1)));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!templateTasks || templateTasks.length === 0) {
      window.localStorage.removeItem(TEMPLATE_KEY);
      return;
    }
    window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templateTasks));
  }, [templateTasks]);

  const tasksForSelected = tasksByDate[selectedDate] ?? [];

  const handleAddTask = () => {
    const text = newTaskText.trim();
    if (!text) return;

    const task = createTask(text, 1);

    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      return {
        ...prev,
        [selectedDate]: [task, ...prevForDate]
      };
    });
    setNewTaskText('');
    
    if (isTelegram) {
      TelegramAPI.HapticFeedback.notification('success');
    }
  };

  const handleToggleTask = (id: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        completed: !task.completed
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleToggleCollapse = (id: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        collapsed: !task.collapsed
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleToggleImportant = (id: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        isImportant: !task.isImportant
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = deleteTaskFromTree(prevForDate, id);
      const next: TasksByDate = { ...prev };
      if (updated.length === 0) {
        delete next[selectedDate];
      } else {
        next[selectedDate] = updated;
      }
      return next;
    });
  };

  const handleInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTask();
    }
  };

  const handleSubInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddSubtask();
    }
  };

  const handleAddSubtask = () => {
    const text = subText.trim();
    if (!text || !subParentId) return;

    if (templateMode) {
      setTemplateTasks((prev) => addSubtaskToTree(prev, subParentId, text));
      setSubText('');
      setSubParentId(null);
      return;
    }

    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = addSubtaskToTree(prevForDate, subParentId, text);
      return {
        ...prev,
        [selectedDate]: updated
      };
    });

    setSubText('');
    setSubParentId(null);
  };

  const handleChangeTime = (id: string, value: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        time: value || undefined
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleChangeDueDate = (id: string, value: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        dueDate: value || undefined
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleChangeDeadline = (id: string, value: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        deadline: value || undefined
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleChangeAlarm = (id: string, value: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        alarm: value || undefined
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleChangeNote = (id: string, value: string) => {
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const updated = updateTaskInTree(prevForDate, id, (task) => ({
        ...task,
        note: value || undefined
      }));
      return {
        ...prev,
        [selectedDate]: updated
      };
    });
  };

  const handleApplyTemplateToSelectedDay = () => {
    if (!templateTasks || templateTasks.length === 0) return;
    if (!selectedDate) return; // Проверяем что день выбран
    
    setTasksByDate((prev) => {
      const prevForDate = prev[selectedDate] ?? [];
      const clones = templateTasks.map((t) => cloneTask(t, 1));
      setLastTemplateApply({ date: selectedDate, prevTasks: prevForDate });
      return {
        ...prev,
        [selectedDate]: [...prevForDate, ...clones]
      };
    });
  };

  const handleUndoTemplateApply = () => {
    if (!lastTemplateApply) return;
    if (lastTemplateApply.date !== selectedDate) return;
    setTasksByDate((prev) => ({
      ...prev,
      [selectedDate]: lastTemplateApply.prevTasks
    }));
    setLastTemplateApply(null);
  };

  const handleAddTemplateTask = () => {
    const text = templateNewTaskText.trim();
    if (!text) return;
    const task = createTask(text, 1);
    setTemplateTasks((prev) => [task, ...prev]);
    setTemplateNewTaskText('');
  };

  const handleDeleteTemplateTask = (id: string) => {
    setTemplateTasks((prev) => deleteTaskFromTree(prev, id));
  };

  const handleToggleTemplateTask = (id: string) => {
    setTemplateTasks((prev) =>
      updateTaskInTree(prev, id, (task) => ({ ...task, completed: !task.completed }))
    );
  };

  const handleToggleTemplateImportant = (id: string) => {
    setTemplateTasks((prev) =>
      updateTaskInTree(prev, id, (task) => ({ ...task, isImportant: !task.isImportant }))
    );
  };

  const handleToggleTemplateCollapse = (id: string) => {
    setTemplateTasks((prev) =>
      updateTaskInTree(prev, id, (task) => ({ ...task, collapsed: !task.collapsed }))
    );
  };

  const handleAddTemplateSubtask = (parentId: string, text: string) => {
    setTemplateTasks((prev) => addSubtaskToTree(prev, parentId, text));
  };

  const handleSelectEmoji = (emoji: string) => {
    setEmojisByDate((prev) => ({
      ...prev,
      [selectedDate]: emoji
    }));
    setEmojiPickerOpen(false);
  };

  const handleClearEmoji = () => {
    setEmojisByDate((prev) => {
      const next = { ...prev };
      delete next[selectedDate];
      return next;
    });
  };

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendar.year, calendar.month, 1);
    const lastDay = new Date(calendar.year, calendar.month + 1, 0);

    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const cells: Array<number | null> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }

    const weeks: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [calendar.year, calendar.month]);

  const today = todayISO();

  const handlePrevMonth = () => {
    setCalendar((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCalendar((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleSelectDay = (day: number | null) => {
    if (!day) return;
    const iso = isoFromYMD(calendar.year, calendar.month, day);
    setSelectedDate(iso);
    setTemplateMode(false); // Выходим из режима шаблона при выборе дня
  };

  const renderTasks = (
    items: Task[],
    opts?: {
      onToggleTask?: (id: string) => void;
      onToggleImportant?: (id: string) => void;
      onToggleCollapse?: (id: string) => void;
      onDeleteTask?: (id: string) => void;
      onStartAddSubtask?: (id: string) => void;
    }
  ): JSX.Element[] =>
    items.map((task) => (
      <div key={task.id} className="space-y-1">
        <div
          className="flex items-center justify-between rounded-xl bg-black border border-white/20 px-3 py-2"
          style={{ marginLeft: (task.level - 1) * 12 }}
        >
          <button
            type="button"
            onClick={() => (opts?.onToggleTask ?? handleToggleTask)(task.id)}
            className="flex items-center gap-2 flex-1"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                task.completed
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'border-white/40 text-transparent'
              }`}
            >
              ✓
            </span>
            {task.children.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  (opts?.onToggleCollapse ?? handleToggleCollapse)(task.id);
                }}
                className="h-4 w-4 flex items-center justify-center text-white/60 hover:text-white transition-transform"
                style={{ transform: task.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              >
                ▼
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                (opts?.onToggleImportant ?? handleToggleImportant)(task.id);
              }}
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                task.isImportant ? 'border-red-600 text-red-600' : 'border-white/40 text-white/40'
              }`}
            >
              ★
            </button>
            <span
              className={`flex-1 text-sm text-center ${
                task.completed ? 'line-through text-white/50' : 'text-white'
              }`}
            >
              {task.text}
            </span>
          </button>
          <div className="flex items-center gap-2 ml-2">
            {task.level < MAX_LEVEL && (
              <button
                type="button"
                onClick={() => (opts?.onStartAddSubtask ?? ((id: string) => {
                  setSubParentId(id);
                  setSubText('');
                }))(task.id)}
                className="h-5 w-5 flex items-center justify-center rounded-full border border-white/40 text-xs text-white/60 hover:border-red-600 hover:text-red-600"
              >
                +
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setSettingsOpenId((prev) => (prev === task.id ? null : task.id))
              }
              className="h-5 w-5 flex items-center justify-center rounded-full border border-white/40 text-xs text-white/60 hover:border-red-600 hover:text-red-600"
            >
              •
            </button>
            <button
              type="button"
              onClick={() => (opts?.onDeleteTask ?? handleDeleteTask)(task.id)}
              className="h-5 w-5 flex items-center justify-center rounded-full border border-white/40 text-xs text-white/50 hover:border-red-600 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>

        {!task.collapsed && task.children.length > 0 && renderTasks(task.children, opts)}

        {subParentId === task.id && (
          <div
            className="flex items-center gap-2 rounded-xl bg-black border border-white/15 px-3 py-2"
            style={{ marginLeft: task.level * 12 }}
          >
            <button
              type="button"
              onClick={handleAddSubtask}
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-600 text-white text-sm leading-none hover:bg-red-700 transition"
            >
              +
            </button>
            <input
              type="text"
              value={subText}
              onChange={(e) => setSubText(e.target.value)}
              onKeyDown={handleSubInputKeyDown}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-center"
              placeholder=""
            />
          </div>
        )}

        {settingsOpenId === task.id && (
          <div
            className="rounded-xl bg-black border border-white/15 px-3 py-2 space-y-2"
            style={{ marginLeft: task.level * 12 }}
          >
            <div className="flex gap-2">
              <input
                type="time"
                value={task.time ?? ''}
                onChange={(e) => handleChangeTime(task.id, e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none border border-white/20 rounded-lg px-2 py-1 text-center text-white"
                placeholder="Время"
              />
              <div className="flex-1 flex items-center gap-1 border border-white/20 rounded-lg px-2 py-1">
                <span className="text-white/60">[D]</span>
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={(e) => handleChangeDueDate(task.id, e.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none text-center text-white"
                  placeholder="Дата"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1 border border-white/20 rounded-lg px-2 py-1">
                <span className="text-white/60">[X]</span>
                <input
                  type="date"
                  value={task.deadline ?? ''}
                  onChange={(e) => handleChangeDeadline(task.id, e.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none text-center text-white"
                  placeholder="Дедлайн"
                />
              </div>
              <input
                type="datetime-local"
                value={task.alarm ?? ''}
                onChange={(e) => handleChangeAlarm(task.id, e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none border border-white/20 rounded-lg px-2 py-1 text-center text-white"
                placeholder="Будильник"
              />
            </div>
            <input
              type="text"
              value={task.note ?? ''}
              onChange={(e) => handleChangeNote(task.id, e.target.value)}
              className="w-full bg-transparent text-xs outline-none border border-white/20 rounded-lg px-2 py-1 text-center placeholder:text-white/40 text-white"
              placeholder="Заметка..."
            />
          </div>
        )}
      </div>
    ));

  return (
    <div
      className="min-h-screen flex items-start justify-center bg-black text-white px-3 py-4 sm:px-4 sm:py-6"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color, #000000)',
        color: 'var(--tg-theme-text-color, #ffffff)'
      }}
    >
      <div className="w-full max-w-4xl flex flex-col gap-4 sm:gap-6">
        {/* Логотип и год вверху */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <img 
            src="./logo.png" 
            alt="Calentodobot Logo" 
            className="w-32 h-32 object-contain"
          />
          <div className="text-red-600 text-2xl font-bold">
            {calendar.year}
          </div>
        </div>
        <div className="flex gap-2 mb-2 w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              if (templateMode) {
                setTemplateMode(false);
                setTemplateNewTaskText('');
              } else {
                setTemplateMode(true);
                setSelectedDate(''); // Отменяем выбор дня
              }
            }}
            className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-lg border transition ${
              templateMode
                ? 'border-red-600 text-red-600'
                : 'border-white/20 text-white/60 hover:border-red-600 hover:text-red-600'
            }`}
          >
            <span className="text-lg">🗊</span>
            <span className="text-sm">🖊</span>
          </button>
          <button
            type="button"
            onClick={handleApplyTemplateToSelectedDay}
            className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg border border-white/20 text-white/60 hover:border-red-600 hover:text-red-600 transition"
            disabled={templateTasks.length === 0}
          >
            <span className="text-lg">🗊</span>
            <span className="text-sm">+</span>
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="rounded-2xl bg-black shadow-sm border border-white/10 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-8 w-8 flex items-center justify-center rounded-full text-white/60 hover:bg-white/5"
              >
                ‹
              </button>
              <div className="text-sm font-medium text-white text-center flex-1">
                {formatMonth(calendar.year, calendar.month)}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-8 w-8 flex items-center justify-center rounded-full text-white/60 hover:bg-white/5"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-white/40 mb-1">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              {calendarCells.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day, di) => {
                    if (!day) {
                      return <div key={`${wi}-${di}`} className="h-9 sm:h-10" />;
                    }
                    const iso = isoFromYMD(calendar.year, calendar.month, day);
                    const isToday = iso === today;
                    const isSelected = iso === selectedDate;
                    const hasTasks = (tasksByDate[iso]?.length ?? 0) > 0;
                    const dayEmoji = emojisByDate[iso];

                    return (
                      <button
                        key={`${wi}-${di}`}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDate('');
                            setTemplateMode(false);
                          } else {
                            handleSelectDay(day);
                          }
                        }}
                        className={`h-9 sm:h-10 flex flex-col items-center justify-center rounded-lg border text-xs transition ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : isToday
                              ? 'border-red-600 bg-black text-red-600'
                              : 'border-transparent hover:border-white/20 hover:bg-white/5 text-white/80'
                        }`}
                      >
                        <span>{day}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {dayEmoji && (
                            <span className="text-xs">{dayEmoji}</span>
                          )}
                          {hasTasks && !isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* Правая панель - показываем только если выбран день или открыт шаблон */}
          {(selectedDate || templateMode) && (
            <section className="rounded-2xl bg-black shadow-sm border border-white/10 p-3 sm:p-4 flex flex-col">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center justify-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/20 text-white/60 hover:border-red-600 hover:text-red-600 transition"
                >
                  {emojisByDate[selectedDate] || '☺'}
                </button>
                <div className="text-lg font-semibold text-white text-center">
                  {templateMode ? '🗊' : formatDateForDisplay(selectedDate)}
                </div>
              </div>
              {templateMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setTemplateMode(false);
                    setTemplateNewTaskText('');
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:border-red-600 hover:text-red-600 transition"
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-red-600 text-white text-lg leading-none hover:bg-red-700 transition"
                >
                  +
                </button>
              )}
              {!templateMode && emojisByDate[selectedDate] && (
                <button
                  type="button"
                  onClick={handleClearEmoji}
                  className="h-6 w-6 flex items-center justify-center rounded-full border border-white/20 text-xs text-white/60 hover:border-red-600 hover:text-red-600 transition"
                >
                  ×
                </button>
              )}

            {emojiPickerOpen && (
              <div className="mb-3 p-3 rounded-lg bg-black border border-white/10">
                <div className="grid grid-cols-6 gap-2">
                  {['☺', '☻', '♡', '♤', '♣', '♠', '♦', '♧', '♩', '♪', '♫', '♬', '♭', '☠', '☢', '☣', '☤', '☥', '☦', '☧', '☨', '☩', '♨', '♯', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅', '⚆', '⚇', '⚈', '⚉', '⚊', '⚋', '⚌', '⚍', '⚎', '⚏', '⚐', '⚑', '⚒', '⚓', '⚔', '⚕', '⚖', '⚗', '⚘', '⚙', '⚚', '⚛', '⚜', '⚝', '⚞', '⚟', '⚠', '⚡', '⚪', '⚫', '⚬', '⚭', '⚮', '⚯', '⚰', '⚱', '⚲', '⚳', '⚴', '⚵', '⚶', '⚷', '⚸', '⚹', '⚺', '⚻', '⚼', '⚽', '⚾', '⚿', '⛄', '⛅', '⛆', '⛇', '⛈', '⛉', '⛊', '⛋', '⛌', '⛍', '⛎', '⛏', '⛐', '⛑', '⛒', '⛓', '⛔', '⛕', '⛖', '⛗', '⛘', '⛙', '⛚', '⛛', '⛜', '⛝', '⛞', '⛟', '⛠', '⛡', '⛢', '⛣', '⛤', '⛥', '✀', '✁', '✂', '✃', '✄', '✅', '✆', '✇', '✈', '✉', '✊', '✋', '✌', '✍', '✎', '✏', '✐', '✑', '✒', '✓', '✔', '✕', '✖', '✗', '✘', '✙', '✚', '✛', '✜', '✝', '✞', '✟', '✠', '✡', '✢', '✣', '✤', '✥', '✦', '✧', '❌', '❍', '❎', '❏', '❐', '❑', '❒', '❓', '❔', '❕', '❖', '❗', '❘', '❙', '❚', '❛', '❜', '❝', '❞', '❟', '❠', '❡', '❢', '❣', '¯\_(ツ)_/¯', '(╯°□°）╯︵ ┻━┻', '( ͡° ͜ʖ ͡°)', 'ಠ_ಠ', '(◔_◔)', '(¬_¬)', '(•_•)', '(ツ)', '(╯°□°）╯', '(づ￣ ³￣)づ', '(｡◕‿◕｡)', '(＾ｖ＾)', '(⌐■_■)', '┬─┬ノ( º _ ºノ)', '(╯°□°）╯︵ ┻━┻', '¯\_(ツ)_/¯', '(ಠ_ಠ)', '(◕‿◕)', '(╯°□°）╯', '(づ｡◕‿‿◕｡)づ', '(Y)', '(^_^)b', '(O_o)', '(o.O)', '(>.<)', '(^_^;)', '(-_-;)', '(¬_¬)', '(O_o)', '(o_O)', '(>_<)', '(^_^;)', '(-_-;)', '(¬_¬)', '(O_o)', '(o_O)', '(>_<)', '(^_^;)', '(-_-;)', '(¬_¬)'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelectEmoji(emoji)}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10 transition text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!templateMode && tasksForSelected.length === 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 rounded-xl bg-black border border-white/20 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-600 text-white text-lg leading-none hover:bg-red-700 transition"
                  >
                    +
                  </button>
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder=""
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-center text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto min-h-[120px]">
              {templateMode ? (
                <>
                  <div className="mb-2">
                    <div className="flex items-center gap-2 rounded-xl bg-black border border-white/20 px-3 py-2">
                      <button
                        type="button"
                        onClick={handleAddTemplateTask}
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-600 text-white text-lg leading-none hover:bg-red-700 transition"
                      >
                        +
                      </button>
                      <input
                        type="text"
                        value={templateNewTaskText}
                        onChange={(e) => setTemplateNewTaskText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTemplateTask();
                          }
                        }}
                        placeholder=""
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-center text-white"
                      />
                    </div>
                  </div>
                  {templateTasks.length > 0 &&
                    renderTasks(templateTasks, {
                      onToggleTask: handleToggleTemplateTask,
                      onToggleImportant: handleToggleTemplateImportant,
                      onToggleCollapse: handleToggleTemplateCollapse,
                      onDeleteTask: handleDeleteTemplateTask,
                      onStartAddSubtask: (id) => {
                        setSubParentId(id);
                        setSubText('');
                      }
                    })}
                </>
              ) : (
                <>
                  {lastTemplateApply && lastTemplateApply.date === selectedDate && (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={handleUndoTemplateApply}
                        className="w-full py-2 rounded-lg border border-white/20 text-white/60 hover:border-red-600 hover:text-red-600 transition"
                      >
                        ↶
                      </button>
                    </div>
                  )}
                  {tasksForSelected.length > 0 && renderTasks(tasksForSelected)}
                </>
              )}
            </div>
          </section>
          )}
        </div>

        {quickAddOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-white/20 rounded-2xl p-4 max-w-md w-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Новая задача</h3>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddOpen(false);
                    setNewTaskText('');
                  }}
                  className="text-white/60 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTask();
                      setQuickAddOpen(false);
                      setNewTaskText('');
                    }
                  }}
                  placeholder=""
                  className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-white/40 text-center text-white"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAddTask();
                  setQuickAddOpen(false);
                  setNewTaskText('');
                }}
                className="w-full py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition"
              >
                Добавить задачу
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

