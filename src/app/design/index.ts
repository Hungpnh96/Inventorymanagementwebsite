// EPIC-005 — Design layer re-exports for ergonomic imports:
//   import { ACTION, STOCK_COLOR, notify } from '../design';

export { ACTION } from './action-styles';
export type { ActionKind, ActionStyle, ButtonVariant } from './action-styles';

export {
  STOCK_COLOR,
  TX_COLOR,
  ROLE_BADGE_VARIANT,
  STOCK_LABEL,
  STOCK_LOW_THRESHOLD,
  stockStatusFromValue,
} from './status-colors';
export type { StockStatus, TransactionType, RoleBadge } from './status-colors';

export { notify } from './toast-config';
