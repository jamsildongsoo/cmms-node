import { EditorContent, useEditor } from '@tiptap/react';
import { createTiptapExtensions } from './tiptapExtensions';
import {
  createEmptyRichTextDocument,
  type RichTextDocument,
} from '../types/richText';

interface RichTextViewerProps {
  content: RichTextDocument | null;
  className?: string;
  preservePrintFormatting?: boolean;
}

export default function RichTextViewer({
  content,
  className = '',
  preservePrintFormatting = false,
}: RichTextViewerProps) {
  const editor = useEditor(
    {
      extensions: createTiptapExtensions(),
      content: content ?? createEmptyRichTextDocument(),
      editable: false,
      editorProps: {
        attributes: {
          class: `rich-text-content focus:outline-none${preservePrintFormatting ? ' preserve-print-formatting' : ''}`,
        },
      },
    },
    [content, preservePrintFormatting],
  );

  if (!editor) return null;

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
