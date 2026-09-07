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
  kind: "material" | "live" | "schedule" | "remark";
  title: string;
  body: string;
  href?: string;
  at: number;
};

export type TeacherRemark = {
  id: string;
  text: string;
  from: string;
  teacherId: string;
  classCode?: string;
  className?: string;
  at: number;
  read?: boolean;
};

export type AttendanceAttendee = {
  studentId: string;
  name: string;
  joinedAt: number;
  leftAt?: number;
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
  /** Students kicked from this live session (cannot rejoin until new live) */
  kickedIds?: string[];
  /** studentId → kick reason */
  kickReasons?: Record<string, string>;
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
  /**
   * Teacher materials by class code — short https URLs only.
   */
  materialBank?: Record<string, TeacherMaterial[]>;
  /** Public JSON index of all class materials (durable across serverless). */
  materialsIndexUrl?: string | null;
  /** primary / last joined (compat) */
  joinedClassCode?: string | null;
  /** student can join multiple teacher codes */
  joinedClassCodes?: string[];
  /** code → teacherId for fast lookup (avoids scanning all users) */
  joinedClassMap?: Record<string, string>;
  /** teacher remarks delivered to student */
  teacherRemarks?: TeacherRemark[];
  /** maps code -> teacherId for fast join (also mirrored on each teacher) */
  activeClassCode?: string | null;
};
