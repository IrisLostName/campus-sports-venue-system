// 项目内联图标（UI-2a 大屏图标提升为共用，UI-2b 增加管理端导航与大屏面板标题图标）：24×24 视框、描边绘制，颜色取 currentColor。
// 每个图标是一条路径（可含多个子路径）。不使用图标字体，也不从外部加载；由 components/ui/UiIcon.vue 渲染。
export const ICONS = {
  // UI-2a 运营大屏（路径不变）
  dashboard: 'M4 15a8 8 0 1 1 16 0M12 15l4-4M7 15h.01M17 15h.01M12 9v.01',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  bolt: 'M13 3 6 13h5l-1 8 7-10h-5z',
  gauge: 'M4 19h16M7 16V11M12 16V7M17 16v-3',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  fullscreenExit: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  sync: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',

  // UI-2b 管理端导航
  calendarCheck: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M9 15l2 2 4-4',
  court: 'M3 6h18v12H3zM12 6v12M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  grid: 'M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16',
  megaphone: 'M4 10v4h3l7 4V6l-7 4zM17.5 9a4 4 0 0 1 0 6M7 14l1 5h2.5l-1-4.5',
  wrench: 'M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z',
  history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
  building: 'M4 20h16M6 20V5h8v15M14 9h4v11M9 8h2M9 11h2M9 14h2',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  users: 'M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5.5',
  broadcast: 'M12 12h.01M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8',
  barChart: 'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',

  // UI-2b 运营大屏面板标题
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  trend: 'M4 4v16h16M7 15l4-4 3 3 5-6',
  pie: 'M11 4a8 8 0 1 0 9 9h-9zM14 3.5a8 8 0 0 1 6.5 6.5H14z',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
} as const

export type UiIconName = keyof typeof ICONS
