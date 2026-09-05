"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div className="sl-md text-sm leading-relaxed text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-xl font-extrabold text-slate-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-lg font-bold text-slate-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-bold text-indigo-800 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-[15px] leading-7 text-slate-700 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-2 pl-5 text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7 marker:font-semibold marker:text-indigo-600">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-800">{children}</em>
          ),
          code: ({ className, children }) => {
            const block = Boolean(className);
            if (block) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-6 text-emerald-200">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[13px] text-indigo-800">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl bg-slate-900 p-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-indigo-400 bg-indigo-50/60 py-2 pl-4 pr-3 text-slate-700">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-semibold text-indigo-600 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-slate-200" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-100 px-3 py-2 font-bold text-slate-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-slate-100 px-3 py-2 text-slate-700">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
