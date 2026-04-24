/**
 * Shared ReactMarkdown component configuration for rendering AI chat responses.
 * Used by both inline and floating chat modes.
 */

import { Suspense, lazy } from "react";
import type { Components } from "react-markdown";

const ReactMarkdown = lazy(() => import("react-markdown"));

/** Standard set of Markdown component overrides for the AI chat. */
export const markdownComponents: Components = {
  strong: ({ children }) => (
    <strong className="font-bold text-primary">{children}</strong>
  ),
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-3 mb-2 text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-3 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold mt-2 mb-1 text-foreground">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-4 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 my-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  p: ({ children }) => <p className="my-1.5">{children}</p>,
  code: ({ children }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted p-2 rounded-lg my-2 overflow-x-auto text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
};

interface ChatMarkdownProps {
  content: string;
  className?: string;
  components?: Components;
}

/** Renders markdown content using the shared AI chat styles. */
export function ChatMarkdown({ content, className, components }: ChatMarkdownProps) {
  return (
    <Suspense fallback={<p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>}>
      <div className={className || "text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-primary prose-strong:font-semibold"}>
        <ReactMarkdown components={components || markdownComponents}>{content}</ReactMarkdown>
      </div>
    </Suspense>
  );
}
