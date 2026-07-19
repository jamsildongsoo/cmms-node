import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

export interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({ content, onChange, placeholder, minHeight = '200px' }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'focus:outline-none p-3 text-slate-200 text-sm',
      },
    },
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-[11px] font-semibold rounded border-0 transition-colors cursor-pointer ${
      active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className="tiptap-editor-root">
      <style>{`
        .tiptap-editor-root .ProseMirror table { border-collapse: collapse; margin: 0; overflow: hidden; table-layout: fixed; width: 100%; }
        .tiptap-editor-root .ProseMirror td, .tiptap-editor-root .ProseMirror th { border: 1px solid #334155; box-sizing: border-box; min-width: 1em; padding: 6px 8px; position: relative; vertical-align: top; }
        .tiptap-editor-root .ProseMirror th { background-color: #334155; color: #e2e8f0; font-weight: 600; text-align: left; }
        .tiptap-editor-root .ProseMirror .selectedCell { outline: 2px solid #3b82f6; }
        .tiptap-editor-root .ProseMirror [data-placeholder] { display: none; }
        .tiptap-editor-root .ProseMirror p.is-editor-empty:first-child::before { color: #64748b; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        .tiptap-editor-root .ProseMirror ul, .tiptap-editor-root .ProseMirror ol { padding-left: 1.5rem; }
        .tiptap-editor-root .ProseMirror a { color: #60a5fa; text-decoration: underline; }
      `}</style>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-slate-900 border-b border-slate-800">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))}><u>U</u></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))}><s>S</s></button>
        <span className="text-slate-700 mx-1">|</span>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}>1.</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>•</button>
        <span className="text-slate-700 mx-1">|</span>
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btn(false)}>표 삽입</button>
        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn(false)}>행+</button>
        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn(false)}>열+</button>
        <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={btn(false)}>행-</button>
        <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={btn(false)}>열-</button>
        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={btn(false)}>표 삭제</button>
        <span className="text-slate-700 mx-1">|</span>
        <button type="button" onClick={() => {
          const url = window.prompt('URL 입력:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} className={btn(editor.isActive('link'))}>링크</button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} className={btn(false)} disabled={!editor.isActive('link')}>링크 해제</button>
        <button type="button" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className={btn(false)}>서식 지우기</button>
      </div>
      {/* Editor Content */}
      <EditorContent editor={editor} placeholder={placeholder} style={{ minHeight }} />
    </div>
  );
}
