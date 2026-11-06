import { IconCopy, IconSend } from './icons';

interface Props {
  disabled: boolean;
  subtitle: string; // "3 que foram"
  onCopy: () => void;
  onShare: () => void;
}

export function FloatingActions({ disabled, subtitle, onCopy, onShare }: Props) {
  return (
    <div className="fabs">
      <button type="button" className="fab-copy" disabled={disabled} onClick={onCopy} aria-label={`Copiar lista: ${subtitle}`}>
        <IconCopy size={22} />
      </button>
      <button type="button" className="fab-share" disabled={disabled} onClick={onShare} aria-label={`Enviar no WhatsApp: ${subtitle}`}>
        <IconSend size={22} />
        <span className="fab-share__text">
          <strong>Enviar no WhatsApp</strong>
          <small>{subtitle}</small>
        </span>
      </button>
    </div>
  );
}
