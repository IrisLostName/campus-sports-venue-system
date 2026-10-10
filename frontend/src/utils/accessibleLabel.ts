// 表格每一行里重复出现的按钮的可访问名称（FE-8 L11）：以按钮的可见文字开头（WCAG 2.5.3 名称中的标签），再附上该行的对象名，
// 这样读屏软件列出所有按钮时能分辨“编辑资料：网球馆”和“编辑资料：游泳馆”。与开关已有的“对用户开放预约：网球馆”同一个写法。
export function labelFor(visibleText: string, object: string): string {
  return `${visibleText}：${object}`
}
