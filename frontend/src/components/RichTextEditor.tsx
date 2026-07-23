import { useEditor, EditorContent } from '@tiptap/react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { createTiptapExtensions } from './tiptapExtensions';
import type { RichTextDocument } from '../types/richText';

const TEXT_COLORS = [
  { label: '기본 글자색', value: '' },
  { label: '빨강', value: '#ef4444' },
  { label: '주황', value: '#f97316' },
  { label: '초록', value: '#22c55e' },
  { label: '파랑', value: '#3b82f6' },
  { label: '보라', value: '#a855f7' },
];

export interface RichTextEditorProps {
  content: RichTextDocument;
  onChange: (document: RichTextDocument) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({ content, onChange, placeholder, minHeight = '200px' }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: createTiptapExtensions(),
    content,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichTextDocument),
      editorProps: {
      attributes: {
        class: 'rich-text-content focus:outline-none p-3 text-slate-200 text-sm',
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
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-slate-900 border-b border-slate-800">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))}><u>U</u></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))}><s>S</s></button>
        <span className="text-slate-700 mx-1">|</span>
        <label className="sr-only" htmlFor="editor-text-color">글자색</label>
        <select
          id="editor-text-color"
          aria-label="글자색"
          title="글자색"
          value={editor.getAttributes('textStyle').color || ''}
          onChange={(event) => {
            const color = event.target.value;
            if (color) editor.chain().focus().setColor(color).run();
            else editor.chain().focus().unsetColor().run();
          }}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 text-[11px] cursor-pointer"
        >
          {TEXT_COLORS.map((color) => (
            <option key={color.label} value={color.value}>{color.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fde68a' }).run()} className={btn(editor.isActive('highlight'))}>H</button>
        <span className="text-slate-700 mx-1">|</span>
        <button type="button" aria-label="왼쪽 정렬" title="왼쪽 정렬" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }) || !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'justify' }))}><AlignLeft size={14} aria-hidden="true" /></button>
        <button type="button" aria-label="가운데 정렬" title="가운데 정렬" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))}><AlignCenter size={14} aria-hidden="true" /></button>
        <button type="button" aria-label="오른쪽 정렬" title="오른쪽 정렬" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))}><AlignRight size={14} aria-hidden="true" /></button>
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
      </div>
      {/* Editor Content */}
      <EditorContent editor={editor} placeholder={placeholder} style={{ minHeight }} />
    </div>
  );
}
