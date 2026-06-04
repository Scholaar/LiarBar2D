export interface GameKeyHandlers {
  onLeft: () => void;
  onRight: () => void;
  onSelect: () => void;
  onPlay: () => void;
  onChallenge: () => void;
  onChat: () => void;
}

export function bindGameKeys(handlers: GameKeyHandlers): () => void {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlers.onLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handlers.onRight();
        break;
      case ' ':
        e.preventDefault();
        handlers.onSelect();
        break;
      case 'Enter':
        e.preventDefault();
        handlers.onPlay();
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        handlers.onChallenge();
        break;
      case 't':
      case 'T':
        e.preventDefault();
        handlers.onChat();
        break;
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
