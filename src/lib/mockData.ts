export const mockProjects = [
  {
    id: "johnson",
    name: "ジョンソン",
    status: "対応中",
    deadline: "2026.03.20",
    client: null,
    taskCount: { done: 0, total: 1 },
  },
  {
    id: "test",
    name: "テスト",
    status: "対応中",
    deadline: "2026.03.20",
    client: null,
    taskCount: { done: 0, total: 0 },
  },
];

export const mockTasks = [
  {
    id: "1",
    projectName: "ジョンソン",
    projectId: "johnson",
    title: "修正指示",
    deadline: "26.03.21",
    status: "未対応",
  },
];

export const mockClients = [
  { id: "1", name: "ジョンソン株式会社", contact: "田中太郎", email: "tanaka@johnson.co.jp" },
];

export const mockSchedules = [
  {
    id: "1",
    title: "ジョンソン 打ち合わせ",
    date: "2026.03.25",
    time: "14:00",
    projectId: "johnson",
  },
];

export const mockFiles = [
  { id: "1", name: "企画書_v1.pdf", size: "2.3MB", updatedAt: "2026.03.18", projectId: "johnson" },
  { id: "2", name: "絵コンテ_draft.png", size: "1.1MB", updatedAt: "2026.03.19", projectId: "test" },
];
