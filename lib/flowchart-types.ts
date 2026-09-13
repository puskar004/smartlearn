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
  summary?: string;
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
  examBullets: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
};
