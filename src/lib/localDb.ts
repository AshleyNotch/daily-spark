const uuid = () => crypto.randomUUID();

export type Task = {
  id: string;
  brand_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  energy_required: string;
  deadline: string | null;
  estimated_minutes: number | null;
  created_from: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  name: string;
  description: string | null;
  active_deliverables: string | null;
  color: string;
  created_at: string;
};

export type Session = {
  id: string;
  date: string;
  energy_level: number | null;
  focus_brands: string[];
  notes: string | null;
  completed: boolean;
  created_at: string;
};

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

const now = () => new Date().toISOString();

export const tasks = {
  list(): Task[] {
    return read<Task>("ds_tasks").sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  insert(data: Omit<Task, "id" | "created_at" | "updated_at">): Task {
    const all = read<Task>("ds_tasks");
    const row: Task = { ...data, id: uuid(), created_at: now(), updated_at: now() };
    write("ds_tasks", [row, ...all]);
    return row;
  },
  update(id: string, data: Partial<Omit<Task, "id" | "created_at">>): Task | null {
    const all = read<Task>("ds_tasks");
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, updated_at: now() };
    write("ds_tasks", all);
    return all[idx];
  },
  delete(id: string) {
    write("ds_tasks", read<Task>("ds_tasks").filter((t) => t.id !== id));
  },
};

export const brands = {
  list(): Brand[] {
    return read<Brand>("ds_brands").sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  insert(data: Omit<Brand, "id" | "created_at">): Brand {
    const all = read<Brand>("ds_brands");
    const row: Brand = { ...data, id: uuid(), created_at: now() };
    write("ds_brands", [row, ...all]);
    return row;
  },
  update(id: string, data: Partial<Omit<Brand, "id" | "created_at">>): Brand | null {
    const all = read<Brand>("ds_brands");
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data };
    write("ds_brands", all);
    return all[idx];
  },
  delete(id: string) {
    write("ds_brands", read<Brand>("ds_brands").filter((b) => b.id !== id));
  },
};

export const sessions = {
  getByDate(date: string): Session | null {
    return read<Session>("ds_sessions").find((s) => s.date === date) ?? null;
  },
  insert(data: Omit<Session, "id" | "created_at">): Session {
    const all = read<Session>("ds_sessions");
    const row: Session = { ...data, id: uuid(), created_at: now() };
    write("ds_sessions", [row, ...all]);
    return row;
  },
};
