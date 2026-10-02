interface JokoHeroNotebookNoteProps {
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  href?: string;
  className?: string;
  interactive?: boolean;
}

function NotebookPaper({
  title,
  body,
  imageUrl,
  imageAlt,
}: Pick<JokoHeroNotebookNoteProps, 'title' | 'body' | 'imageUrl' | 'imageAlt'>) {
  return (
    <div
      className="relative -rotate-[2deg] overflow-visible rounded-[2px] border border-[#8B7658]/15 bg-[#FFF9EC] px-5 pb-5 pl-9 pt-7 shadow-[0_16px_34px_rgba(48,53,50,.18)]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(114,92,58,.025) 1px, transparent 1px), radial-gradient(circle at 20% 18%, rgba(179,151,102,.08), transparent 42%)',
        backgroundSize: '100% 24px, auto',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-7 w-20 -translate-x-1/2 -translate-y-1/2 rotate-[2deg] border border-[#8D7650]/10 bg-[#E8D7B5]/70 shadow-[0_2px_6px_rgba(55,45,30,.08)]"
      />

      <span aria-hidden="true" className="absolute left-3 top-7 flex flex-col gap-3.5">
        {[0, 1, 2, 3, 4].map((hole) => (
          <span
            key={hole}
            className="block h-2.5 w-2.5 rounded-full border border-[#75654E]/20 bg-[#EAE1D0] shadow-inner"
          />
        ))}
      </span>

      <div className="relative z-10">
        {title && (
          <p
            className="whitespace-pre-line text-[1.35rem] font-semibold leading-[1.08] text-[#2F302E]"
            style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }}
          >
            {title}
          </p>
        )}

        {body && (
          <p
            className="mt-2 whitespace-pre-line text-[0.9rem] leading-5 text-[#3D403C]/75"
            style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }}
          >
            {body}
          </p>
        )}

        {(title || body) && (
          <span
            aria-hidden="true"
            className="mt-2 block h-[2px] w-20 -rotate-3 rounded-full bg-[var(--joko-brand-accent,#C76624)]/75"
          />
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt || ''}
            className="mx-auto mt-3 max-h-36 w-full object-contain mix-blend-multiply"
            decoding="async"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}

export function JokoHeroNotebookNote({
  title,
  body,
  imageUrl,
  imageAlt,
  href,
  className = '',
  interactive = true,
}: JokoHeroNotebookNoteProps) {
  const content = (
    <NotebookPaper
      title={title}
      body={body}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
    />
  );

  if (href && interactive) {
    return (
      <a
        href={href}
        className={`block rounded-sm outline-none transition-transform duration-200 hover:-translate-y-0.5 hover:rotate-[1deg] focus-visible:ring-2 focus-visible:ring-[#55766F] focus-visible:ring-offset-4 ${className}`}
        aria-label={title || body || 'Open notebook note'}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

export default JokoHeroNotebookNote;
