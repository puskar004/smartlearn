export type TaskCadence = "daily" | "weekly" | "monthly";

export type StudyTask = {
  id: string;
  title: string;
  cadence: TaskCadence;
  target: number;
  unit: string;
  done: number;
  completed: boolean;
  createdAt: number;
  resetKey: string; // date key when this period started
};

function periodKey(cadence: TaskCadence, d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (cadence === "daily") return `${y}-${m}-${day}`;
  if (cadence === "weekly") {
    const tmp = new Date(d);
    const dayNum = (tmp.getDay() + 6) % 7; // Mon=0
    tmp.setDate(tmp.getDate() - dayNum);
    return `w-${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, "0")}-${String(tmp.getDate()).padStart(2, "0")}`;
  }
  return `m-${y}-${m}`;
}

export function defaultTasks(): StudyTask[] {
  const now = Date.now();
  return [
    {
      id: "daily-numericals",
      title: "Solve 3 numericals",
      cadence: "daily",
      target: 3,
      unit: "numericals",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("daily"),
    },
    {
      id: "daily-ncert",
      title: "Read 1 NCERT chapter section",
      cadence: "daily",
      target: 1,
      unit: "sections",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("daily"),
    },
    {
      id: "daily-quiz",
      title: "Finish 1 rapid quiz",
      cadence: "daily",
      target: 1,
      unit: "quizzes",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("daily"),
    },
    {
      id: "weekly-pyq",
      title: "Attempt 10 PYQ-style questions",
      cadence: "weekly",
      target: 10,
      unit: "PYQs",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("weekly"),
    },
    {
      id: "weekly-feynman",
      title: "Explain 2 topics (Feynman mode)",
      cadence: "weekly",
      target: 2,
      unit: "topics",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("weekly"),
    },
    {
      id: "monthly-revision",
      title: "Full revision of 4 weak chapters",
      cadence: "monthly",
      target: 4,
      unit: "chapters",
      done: 0,
      completed: false,
      createdAt: now,
      resetKey: periodKey("monthly"),
    },
  ];
}

export function refreshTaskPeriods(tasks: StudyTask[]): StudyTask[] {
  return tasks.map((t) => {
    const key = periodKey(t.cadence);
    if (t.resetKey === key) return t;
    return {
      ...t,
      resetKey: key,
      done: 0,
      completed: false,
    };
  });
}

const TASK_PREFIX = "sl_tasks_v1_";

export function loadTasks(userId: string): StudyTask[] {
  if (typeof window === "undefined") return defaultTasks();
  try {
    const raw = localStorage.getItem(TASK_PREFIX + userId);
    if (!raw) {
      const d = defaultTasks();
      localStorage.setItem(TASK_PREFIX + userId, JSON.stringify(d));
      return d;
    }
    return refreshTaskPeriods(JSON.parse(raw) as StudyTask[]);
  } catch {
    return defaultTasks();
  }
}

export function saveTasks(userId: string, tasks: StudyTask[]) {
  localStorage.setItem(TASK_PREFIX + userId, JSON.stringify(tasks));
}

export function toggleTaskDone(userId: string, taskId: string) {
  // Only flip the exact task id (full complete / uncomplete — no double-step bug)
  const tasks = loadTasks(userId).map((t) => {
    if (t.id !== taskId) return t;
    if (t.completed) {
      return { ...t, completed: false, done: 0 };
    }
    return { ...t, done: t.target, completed: true };
  });
  saveTasks(userId, tasks);
  try {
    window.dispatchEvent(new Event("sl-tasks"));
    window.dispatchEvent(new Event("sl-progress"));
  } catch {
    // ignore
  }
  return tasks;
}

export function bumpTask(
  userId: string,
  taskId: string,
  amount = 1
): StudyTask[] {
  const tasks = loadTasks(userId).map((t) => {
    if (t.id !== taskId) return t;
    const done = Math.min(t.target, t.done + amount);
    return { ...t, done, completed: done >= t.target };
  });
  saveTasks(userId, tasks);
  try {
    window.dispatchEvent(new Event("sl-tasks"));
  } catch {
    // ignore
  }
  return tasks;
}

export function addCustomTask(
  userId: string,
  title: string,
  cadence: TaskCadence,
  target: number,
  unit: string
) {
  const tasks = loadTasks(userId);
  const t: StudyTask = {
    id: `custom-${Date.now()}`,
    title,
    cadence,
    target: Math.max(1, target),
    unit: unit || "items",
    done: 0,
    completed: false,
    createdAt: Date.now(),
    resetKey: periodKey(cadence),
  };
  const next = [t, ...tasks];
  saveTasks(userId, next);
  return next;
}

export function deleteTask(userId: string, taskId: string): StudyTask[] {
  const next = loadTasks(userId).filter((t) => t.id !== taskId);
  saveTasks(userId, next);
  return next;
}
