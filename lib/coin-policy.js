export const COIN_PROGRAM_STARTED_AT = '2026-10-14T03:29:27.000Z';
export const DEFAULT_ENTRY_FEE = 50;
export const FIRST_PLACE_REWARD = 100;
export function parseEntryFee(value) {
  const fee = value === undefined || value === null ? DEFAULT_ENTRY_FEE : Number(value);
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > 1000000) throw new Error('Entry fee must be a whole number from 0 to 1,000,000 coins.');
  return fee;
}
export function assertEntryFeeConfirmed(olympiad, role, expected) {
  if (role !== 'student') return;
  const fee = parseEntryFee(olympiad.entryFeeCoins);
  if (expected === undefined || !Number.isSafeInteger(Number(expected)) || Number(expected) !== fee) {
    const error = new Error(expected === undefined ? 'Please refresh this page to review the entry fee before starting.' : `The entry fee is now ${fee} coins. Review the updated price and press Start again.`);
    error.code = 'ENTRY_FEE_CHANGED'; error.status = 409; error.entryFeeCoins = fee; throw error;
  }
}
