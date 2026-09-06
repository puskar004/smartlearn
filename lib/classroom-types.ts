export type StudentSnapshot = {
  studentId: string;
  name: string;
  email?: string;
  grade: string;
  xp: number;
  streak: number;
  accuracy: number | null;
  mistakes: number;
  weakSubjects: string[];
  chaptersOpened: number;
  lastActive: number;
  recentMistakes: {
    subjectName: string;
    chapterTitle: string;
    prompt: string;
    at: number;
  }[];
};

export type TeacherMaterial = {
  id: string;
  title: string;
  type: "notes" | "video" | "link";
  url: string;
  subject: string;
  createdAt: number;
  teacherName: string;
};

export type LiveSession = {
  id: string;
  title: string;
  subject: string;
  startedAt: number;
  endsAt: number;
  active: boolean;
  joinCode: string;
  /** Google Meet / Zoom link */
  meetUrl?: string;
  /** Future start time — student dashboard shows scheduled class */
  scheduledAt?: number;
  messages: { id: string; author: string; text: string; at: number }[];
};

export type Classroom = {
  code: string;
  name: string;
  teacherId: string;
  teacherName: string;
  createdAt: number;
  students: StudentSnapshot[];
  materials: TeacherMaterial[];
  liveSession: LiveSession | null;
};

export type SmartlearnMeta = {
  role?: "student" | "teacher";
  classrooms?: Classroom[];
  joinedClassCode?: string | null;
  /** maps code -> teacherId for fast join (also mirrored on each teacher) */
  activeClassCode?: string | null;
};
