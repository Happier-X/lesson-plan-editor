# PPT课件内容提取工具

一个简洁高效的PPT内容提取工具，完整无误地提取幻灯片中的所有文字内容。

## 功能特性

- ✅ **完整提取PPT内容**：原封不动提取幻灯片标题、内容和备注
- 📋 **一键复制**：方便快速复制提取的内容
- 🎨 **简洁美观的界面**：使用Nuxt UI和Tailwind CSS构建
- 📄 **文档信息提取**：自动提取PPT的标题、作者、主题等元数据

## 技术栈

- **前端框架**: Nuxt 3
- **UI组件库**: Nuxt UI
- **样式**: Tailwind CSS
- **PPT解析**: adm-zip + xml2js

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 开始使用。

### 3. 构建生产版本

```bash
pnpm build
pnpm preview
```

## 使用说明

### 基础使用

1. 点击上传区域选择 `.pptx` 格式的PPT文件
2. 点击"开始提取"按钮
3. 查看右侧的提取结果
4. 可以单独复制每页内容，也可以一键复制所有内容

### 提取内容说明

工具会完整提取以下内容：
- **幻灯片文本**：每张幻灯片上的所有文字内容，按顺序保留
- **备注内容**：幻灯片的备注信息
- **文档元数据**：PPT的标题、作者、主题等信息

## 项目结构

```
lesson-plan-editor/
├── app/
│   ├── pages/
│   │   └── index.vue          # 主页面
│   └── app.vue                # 根组件
├── server/
│   ├── api/
│   │   └── extract-pptx.post.ts  # PPT提取API
│   └── utils/
│       └── pptx-extractor.ts     # PPT解析工具
├── nuxt.config.ts            # Nuxt配置
└── package.json              # 项目依赖
```

## API说明

### POST /api/extract-pptx

提取PPT内容的API端点。

**请求参数（FormData）**:
- `file`: PPT文件（.pptx格式）

**响应**:
```json
{
  "success": true,
  "data": {
    "content": {
      "slides": [
        {
          "slideNumber": 1,
          "texts": ["标题", "内容1", "内容2"],
          "notes": "备注内容"
        }
      ],
      "totalSlides": 10,
      "metadata": {
        "title": "课件标题",
        "author": "作者",
        "subject": "主题"
      }
    }
  }
}
```

## 注意事项

- 仅支持 `.pptx` 格式的文件（不支持旧版.ppt格式）
- 提取的内容完全保留原始文字，不做任何修改
- 建议使用Chrome或Edge浏览器以获得最佳体验

## License

MIT
