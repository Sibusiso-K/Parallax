import { formatRand } from '../../../../shared/guard/figures';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';

// What the objects in the courtyard show: the contract's terms, the memo board, the tablet. All of it comes from the
// snapshot on screen and is formatted by the same code as the panel, so the room and the panel can never disagree.

export interface RoomReadout {
  pathName: string;
  pathLetter: string;
  month: number;
  cash: string;
  /** Baseline cash at this month, shown beside the cash when the late payment is on. */
  baselineCash: string | null;
  below: boolean;
  lowest: string;
  lowestMonth: number;
  end: string;
  shortfall: number | null;
  firstPayment: number | null;
  stressed: boolean;
  revision: number;
  rows: readonly number[];
  baselineRows: readonly number[];
  assumptions: readonly { label: string; amount: string }[];
}

export function buildReadout(snapshot: RoomSnapshot, month: number): RoomReadout {
  const row = snapshot.active.rows[month - 1] ?? snapshot.active.rows[0]!;
  const stressed = snapshot.ref.setback !== null;
  return {
    pathName: snapshot.pathName,
    pathLetter: snapshot.ref.pathId,
    month: row.month,
    cash: formatRand(row.cash),
    baselineCash: stressed ? formatRand(snapshot.baseline.rows[row.month - 1]!.cash) : null,
    below: row.cash < 0,
    lowest: formatRand(snapshot.active.lowest.cash),
    lowestMonth: snapshot.active.lowest.month,
    end: formatRand(snapshot.active.rows[snapshot.active.rows.length - 1]!.cash),
    shortfall: snapshot.active.firstShortfall,
    firstPayment: snapshot.terms.firstReceiptMonth,
    stressed,
    revision: snapshot.ref.profileRevision,
    rows: snapshot.active.rows.map((r) => r.cash),
    baselineRows: snapshot.baseline.rows.map((r) => r.cash),
    assumptions: snapshot.baselineAssumptions
      .filter((a) => a.role !== 'setback')
      .slice(0, 9)
      .map((a) => ({ label: a.label, amount: formatRand(a.base) })),
  };
}
