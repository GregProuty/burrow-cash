import Decimal from "decimal.js";
import { USD_FORMAT, TOKEN_FORMAT, PERCENT_DIGITS, NEAR_STORAGE_DEPOSIT } from "../../store";
import type { UIAsset } from "../../interfaces";
import { formatWithCommas_number, toDecimal } from "../../utils/uiNumber";
import { expandToken } from "../../store/helper";

interface Alert {
  [key: string]: {
    title: string;
    severity: "error" | "warning" | "info" | "success";
  };
}

interface Props {
  rates: Array<{ label: string; value: string; value$?: string }>;
  apy: number;
  available$: string;
  action: string;
  totalTitle: string;
  healthFactor: number;
  alerts: Alert;
  remainingCollateral?: string;
}

export const actionMapTitle = {
  Supply: "Supply",
  Borrow: "Borrow",
  Adjust: "Adjust Collateral",
  Withdraw: "Withdraw",
  Repay: "Repay",
};

export const getModalData = (asset): UIAsset & Props & { disabled: boolean } => {
  const {
    symbol,
    action,
    supplyApy,
    borrowApy,
    collateralFactor,
    availableLiquidity,
    price,
    maxBorrowAmount,
    supplied,
    collateral,
    borrowed,
    available,
    availableNEAR,
    healthFactor,
    amount,
    maxWithdrawAmount,
    isRepayFromDeposits,
  } = asset;
  const data: any = {
    apy: borrowApy,
    alerts: {},
  };
  let disabled = false;
  if (healthFactor >= 0 && healthFactor <= 105) {
    data.alerts["liquidation"] = {
      title: "Your health factor will be dangerously low and you're at risk of liquidation",
      severity: "error",
    };
  } else {
    delete data.alerts["liquidation"];
  }

  const getAvailableWithdrawOrAdjust = toDecimal(Number(supplied + collateral));

  const isWrappedNear = symbol === "NEAR";
  switch (action) {
    case "Supply":
      data.apy = supplyApy;
      data.totalTitle = `Total Supply`;
      data.rates = [{ label: "Collateral Factor", value: collateralFactor }];
      data.available = toDecimal(available);
      if (isWrappedNear) {
        data.available = toDecimal(
          Number(Math.max(0, available + availableNEAR - NEAR_STORAGE_DEPOSIT)),
        );
      }
      data.alerts = {};
      break;
    case "Borrow":
      data.totalTitle = `Total Borrow`;
      data.available = toDecimal(Math.min(Math.max(0, maxBorrowAmount), availableLiquidity));
      data.rates = [{ label: "Collateral Factor", value: collateralFactor }];

      if (amount !== 0 && Number(amount).toFixed() === maxBorrowAmount?.toFixed()) {
        data.alerts["maxBorrow"] = {
          title: "Due to pricing fluctuations the max borrow amount is approximate",
          severity: "warning",
        };
      }
      break;
    case "Withdraw":
      data.totalTitle = `Withdraw Supply Amount`;
      data.apy = supplyApy;
      data.available = toDecimal(
        Math.min(supplied + collateral, maxWithdrawAmount, availableLiquidity),
      );
      data.rates = [
        {
          label: "Remaining Collateral",
          value: formatWithCommas_number(
            Math.abs(Math.min(collateral, collateral + supplied - amount)),
          ),
          value$: Math.abs(Math.min(collateral, collateral + supplied - amount)) * price,
        },
      ];
      break;
    case "Adjust":
      data.totalTitle = `Amount designated as collateral`;
      data.apy = supplyApy;
      data.available = getAvailableWithdrawOrAdjust;
      data.rates = [];
      break;
    case "Repay":
      data.totalTitle = `Repay Borrow Amount`;
      data.available = toDecimal(
        isRepayFromDeposits
          ? Math.min(maxWithdrawAmount, borrowed)
          : Math.min(
              isWrappedNear
                ? Number(Math.max(0, available + availableNEAR - NEAR_STORAGE_DEPOSIT))
                : available,
              borrowed,
            ),
      );
      data.alerts = {};
      data.rates = [
        {
          label: "Remaining Borrow",
          value: (borrowed - amount).toFixed(PERCENT_DIGITS),
          value$: new Decimal(borrowed - amount).mul(price).toFixed(),
        },
      ];
      if (isRepayFromDeposits) {
        data.rates.push({
          label: "Remaining Deposit Amount",
          value: (supplied + collateral - amount).toFixed(PERCENT_DIGITS),
        });
      }
      break;

    default:
  }
  if (
    action === "Borrow" ||
    action === "Supply" ||
    action === "Withdraw" ||
    (action === "Repay" && !isRepayFromDeposits)
  ) {
    if (new Decimal(amount || 0).gt(0) && new Decimal(expandToken(amount, asset.decimals)).lt(1)) {
      data.alerts["wallet"] = {
        title:
          "The current balance is below the minimum token decimals, so that it cannot be processed by the contract.",
        severity: "warning",
      };
      disabled = true;
    }
  }

  return {
    ...asset,
    ...data,
    available$: (data.available * price).toLocaleString(undefined, USD_FORMAT),
    disabled,
  };
};
