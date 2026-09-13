export type FlowNodeKind =
  | "start"
  | "concept"
  | "formula"
  | "exam"
  | "tip"
  | "end";

export type FlowNode = {
  id: string;
  label: string;
  kind: FlowNodeKind;
  /** 1–3 sentence revision note */
  summary?: string;
  /** Bullet points student can revise from */
  points?: string[];
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ChapterFlowchart = {
  chapter: string;
  subject?: string;
  grade?: string;
  /** Full chapter revision checklist */
  examBullets: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
};
