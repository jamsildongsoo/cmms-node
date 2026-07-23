export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
}

export interface RichTextDocument extends RichTextNode {
  type: 'doc';
}

export const createEmptyRichTextDocument = (): RichTextDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export const isRichTextDocument = (value: unknown): value is RichTextDocument => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; content?: unknown };
  return candidate.type === 'doc'
    && (candidate.content === undefined || Array.isArray(candidate.content));
};

const hasText = (node: RichTextNode): boolean =>
  Boolean(node.text?.trim()) || Boolean(node.content?.some(hasText));

export const isRichTextEmpty = (document: RichTextDocument | null): boolean =>
  !document || !hasText(document);

export const richTextFromPlainText = (value: string): RichTextDocument => ({
  type: 'doc',
  content: value.split(/\r?\n/).map((line) => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : undefined,
  })),
});
