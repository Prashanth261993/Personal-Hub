import { useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListChecks, Code, Undo, Redo, ImagePlus, Link as LinkIcon, Heading3, Minus } from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TiptapEditor({ content, onChange, placeholder = 'Add notes...' }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none outline-none min-h-[60px] px-3 py-2 text-gray-700 [&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:pl-0 [&_li[data-type="taskItem"]]:flex [&_li[data-type="taskItem"]]:items-start [&_li[data-type="taskItem"]]:gap-2',
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (!imageFiles.length) return false;
        event.preventDefault();
        imageFiles.forEach(async (file) => {
          const src = await readFileAsDataUrl(file);
          view.dispatch(
            view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src }))
          );
        });
        return true;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));
        if (!imageItems.length) return false;
        event.preventDefault();
        imageItems.forEach(async (item) => {
          const file = item.getAsFile();
          if (!file) return;
          const src = await readFileAsDataUrl(file);
          view.dispatch(
            view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src }))
          );
        });
        return true;
      },
    },
  });

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !editor) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const src = await readFileAsDataUrl(file);
      editor.chain().focus().setImage({ src }).run();
    }
    event.target.value = '';
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive, children, title }: { onClick: () => void; isActive: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="tiptap-wrapper border border-gray-200 rounded-lg overflow-hidden focus-within:border-primary-300 focus-within:ring-1 focus-within:ring-primary-200 transition-all">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
      {/* Toolbar */}
      <div className="tiptap-toolbar flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 bg-gray-50/50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-gray-200 mx-1 tiptap-divider" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Task List"
        >
          <ListChecks className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-gray-200 mx-1 tiptap-divider" />
        <ToolbarButton
          onClick={handleSetLink}
          isActive={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          isActive={false}
          title="Insert Image"
        >
          <ImagePlus className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          isActive={false}
          title="Horizontal Rule"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="flex-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Undo"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Redo"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
