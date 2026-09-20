export function CmsHtml({ html }: { html: string }) {
  return (
    <div
      className="cms-body space-y-4 text-sm leading-7 text-muted-foreground [&_blockquote]:tile [&_blockquote]:text-foreground [&_h2]:text-lg [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
