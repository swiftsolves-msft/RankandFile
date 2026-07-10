'use client';

import { QRCodeSVG } from 'qrcode.react';
import { buildJoinUrl } from '../lib/joinLink';

/**
 * QR code that deep-links to the deployed app with the session code prefilled,
 * so a player can scan with a phone/tablet and only needs to enter their name.
 *
 * Rendered on the "Use Code XXXXX to Join Session" banner in both the host lobby
 * and the screen-share presenter window.
 */
export default function JoinQR({
  sessionCode,
  size = 128,
  label = 'Scan to join',
}: {
  sessionCode: string;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* White quiet-zone padding so the code scans on any background */}
      <div className="bg-white rounded-xl p-3">
        <QRCodeSVG
          value={buildJoinUrl(sessionCode)}
          size={size}
          level="M"
          marginSize={0}
        />
      </div>
      {label && (
        <span className="text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      )}
    </div>
  );
}
