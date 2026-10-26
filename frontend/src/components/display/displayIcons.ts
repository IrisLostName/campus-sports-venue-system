// 运营大屏的内联图标（UI-2a）：24×24 视框、描边绘制，颜色取 currentColor。不使用图标字体，也不从外部加载。
export const DISPLAY_ICONS = {
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
} as const

export type DisplayIconName = keyof typeof DISPLAY_ICONS
