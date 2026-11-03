// 首页图集（UI-6）：构建时由 build/galleryPlugin.ts 生成，内容是 public/media/gallery/ 下的图片文件名。
declare module 'virtual:home-gallery' {
  const files: readonly string[]
  export default files
}
