export const DEFAULT_PLATFORM_FEE_RATE = 0.1;
export const CENTS_PER_DOLLAR = 100;

export interface PaidEstimateSplit {
  rewardAmount: number;
  contractorPayoutAmount: number;
  platformFeeAmount: number;
  rewardAmountCents: number;
  contractorPayoutCents: number;
  platformFeeCents: number;
}

export function isValidMoneyAmount(amount: number) {
  return Number.isFinite(amount) && amount >= 0;
}

export function roundCurrency(amount: number) {
  return Math.round(amount * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR;
}

export function dollarsToCents(amount: number) {
  if (!isValidMoneyAmount(amount)) {
    throw new Error("Money amount must be a finite non-negative number.");
  }

  return Math.round(amount * CENTS_PER_DOLLAR);
}

export function centsToDollars(amountInCents: number) {
  if (!Number.isInteger(amountInCents) || amountInCents < 0) {
    throw new Error("Cent amount must be a non-negative integer.");
  }

  return amountInCents / CENTS_PER_DOLLAR;
}

export function calculatePaidEstimateSplit(
  rewardAmount: number,
  platformFeeRate = DEFAULT_PLATFORM_FEE_RATE
): PaidEstimateSplit {
  if (!isValidMoneyAmount(rewardAmount) || rewardAmount <= 0) {
    throw new Error("Reward amount must be a finite number greater than zero.");
  }

  if (
    !Number.isFinite(platformFeeRate) ||
    platformFeeRate < 0 ||
    platformFeeRate > 1
  ) {
    throw new Error("Platform fee rate must be between 0 and 1.");
  }

  const rewardAmountCents = dollarsToCents(rewardAmount);
  const platformFeeCents = Math.round(rewardAmountCents * platformFeeRate);
  const contractorPayoutCents = rewardAmountCents - platformFeeCents;

  return {
    rewardAmount: centsToDollars(rewardAmountCents),
    contractorPayoutAmount: centsToDollars(contractorPayoutCents),
    platformFeeAmount: centsToDollars(platformFeeCents),
    rewardAmountCents,
    contractorPayoutCents,
    platformFeeCents,
  };
}

export function calculatePoolFundingTotal(
  rewardAmount: number,
  maxPaidSlots: number
) {
  if (!Number.isInteger(maxPaidSlots) || maxPaidSlots <= 0) {
    throw new Error("Max paid slots must be a positive integer.");
  }

  return roundCurrency(rewardAmount * maxPaidSlots);
}
