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

export type ClassAlert = {
  id: string;
  kind: "material" | "live" | "schedule";
  title: string;
  body: string;
  href?: string;
  at: number;
};

export type AttendanceAttendee = {
  studentId: string;
  name: string;
  joinedAt: number;
};

export type AttendanceRecord = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  subject: string;
  startedAt: number;
  endedAt?: number;
  attendees: AttendanceAttendee[];
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
  attendees?: AttendanceAttendee[];
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
  /** Cross-device student alerts (material / live / schedule) */
  alerts?: ClassAlert[];
  /** Past + current session attendance */
  attendanceLog?: AttendanceRecord[];
};

export type SmartlearnMeta = {
  role?: "student" | "teacher";
  classrooms?: Classroom[];
  joinedClassCode?: string | null;
  /** maps code -> teacherId for fast join (also mirrored on each teacher) */
  activeClassCode?: string | null;
};
