import Decimal from "decimal.js";
import { USD_FORMAT, TOKEN_FORMAT, PERCENT_DIGITS, NEAR_STORAGE_DEPOSIT } from "../../store";
import type { UIAsset } from "../../interfaces";
import { formatWithCommas_number, toDecimal } from "../../utils/uiNumber";
import { expandToken, shrinkToken } from "../../store/helper";
import { decimalMax } from "../../utils";

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

// Safe number conversion that handles undefined/null
const safeNumber = (val, defaultValue = 0) => {
  if (val === undefined || val === null) return defaultValue;
  return Number(val);
};

// Safe decimal conversion
const safeDecimal = (val, defaultValue = 0) => {
  if (val === undefined || val === null) return new Decimal(defaultValue);
  return new Decimal(val);
};

export const getModalData = (asset): UIAsset & Props & { disabled: boolean } => {
  if (!asset) {
    // Return default data if asset is undefined
    return {
      symbol: '',
      tokenId: '',
      action: 'Supply',
      apy: 0,
      available: 0,
      available$: '0',
      totalTitle: 'Total',
      healthFactor: 100,
      rates: [],
      alerts: {},
      disabled: true,
      price: 0,
      supplied: 0,
      borrowed: 0,
      collateral: 0,
      canUseAsCollateral: false,
      decimals: 18,
      extraDecimals: 0,
    };
  }
  
  const {
    symbol = '',
    action = 'Supply',
    supplyApy = 0,
    borrowApy = 0,
    collateralFactor = 0,
    availableLiquidity = 0,
    price = 0,
    maxBorrowAmount = 0,
    supplied = 0,
    collateral = 0,
    borrowed = 0,
    available = 0,
    availableNEAR = 0,
    healthFactor = 100,
    amount = 0,
    maxWithdrawAmount = 0,
    isRepayFromDeposits = false,
    canUseAsCollateral = false,
    tokenId = '',
    poolAsset = {},
    decimals = 18,
    extraDecimals = 0,
  } = asset;
  
  const data: any = {
    apy: safeNumber(borrowApy),
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

  const getAvailableWithdrawOrAdjust = toDecimal(safeNumber(supplied) + safeNumber(collateral));
  const isWrappedNear = symbol === "NEAR";
  
  switch (action) {
    case "Supply":
      data.apy = safeNumber(supplyApy);
      data.totalTitle = `Total Supplied`;
      data.rates = [
        ...(canUseAsCollateral ? [{ label: "Collateral Factor", value: collateralFactor }] : []),
      ];
      data.available = toDecimal(safeNumber(available));
      if (isWrappedNear) {
        data.available = toDecimal(
          Math.max(0, safeNumber(available) + safeNumber(availableNEAR) - NEAR_STORAGE_DEPOSIT),
        );
      }
      data.alerts = {};
      break;
    case "Borrow":
      data.totalTitle = `Total Borrowed`;
      data.available = toDecimal(Math.min(Math.max(0, safeNumber(maxBorrowAmount)), safeNumber(availableLiquidity)));
      data.rates = [{ label: "Collateral Factor", value: collateralFactor }];

      if (safeNumber(amount) !== 0 && Number(amount).toFixed() === safeNumber(maxBorrowAmount)?.toFixed()) {
        data.alerts["maxBorrow"] = {
          title: "Due to pricing fluctuations the max borrow amount is approximate",
          severity: "warning",
        };
      }
      break;
    case "Withdraw":
      data.totalTitle = `Withdraw Supply Amount`;
      data.apy = safeNumber(supplyApy);
      data.available = toDecimal(
        Math.min(
          safeNumber(supplied) + safeNumber(collateral), 
          safeNumber(maxWithdrawAmount), 
          safeNumber(availableLiquidity)
        ),
      );
      data.rates = [
        {
          label: "Remaining Collateral",
          value: formatWithCommas_number(
            Math.abs(Math.min(safeNumber(collateral), safeNumber(collateral) + safeNumber(supplied) - safeNumber(amount))),
          ),
          value$: Math.abs(Math.min(safeNumber(collateral), safeNumber(collateral) + safeNumber(supplied) - safeNumber(amount))) * safeNumber(price),
        },
      ];
      break;
    case "Adjust":
      data.totalTitle = `Amount designated as collateral`;
      data.apy = safeNumber(supplyApy);
      data.available = getAvailableWithdrawOrAdjust;
      data.rates = [];
      break;
    case "Repay": {
      // TODO
      let minRepay = "0";
      if (poolAsset?.supplied?.shares) {
        minRepay = shrinkToken(
          safeDecimal(poolAsset?.supplied?.balance)
            .div(poolAsset?.supplied?.shares)
            .mul(2)
            .toFixed(0, 2),
          decimals,
        );
      }
      let interestChargedIn1min = "0";
      if (borrowApy && price && borrowed) {
        interestChargedIn1min = safeDecimal(borrowApy)
          .div(365 * 24 * 60)
          .div(100)
          .mul(borrowed)
          .toFixed(decimals, 2);
      }
      const repayAmount = Decimal.max(
        safeDecimal(borrowed).plus(interestChargedIn1min),
        minRepay,
      ).toNumber();
      data.totalTitle = `Repay Borrow Amount`;
      data.available = toDecimal(
        isRepayFromDeposits
          ? Math.min(safeNumber(maxWithdrawAmount), repayAmount)
          : Math.min(
              isWrappedNear
                ? Math.max(0, safeNumber(available) + safeNumber(availableNEAR) - NEAR_STORAGE_DEPOSIT)
                : safeNumber(available),
              repayAmount,
            ),
      );
      data.alerts = {};
      data.rates = [
        {
          label: "Remaining Borrow",
          value: (safeNumber(borrowed) - safeNumber(amount)).toFixed(PERCENT_DIGITS),
          value$: safeDecimal(safeNumber(borrowed) - safeNumber(amount)).mul(price).toFixed(),
        },
      ];
      if (isRepayFromDeposits) {
        data.rates.push({
          label: "Remaining Supplied Amount",
          value: decimalMax(0, (safeNumber(supplied) + safeNumber(collateral) - safeNumber(amount)).toFixed(PERCENT_DIGITS)).toFixed(
            PERCENT_DIGITS,
          ),
        });
      }
      break;
    }
    default:
  }
  if (
    action === "Borrow" ||
    action === "Supply" ||
    action === "Withdraw" ||
    (action === "Repay" && !isRepayFromDeposits)
  ) {
    if (safeDecimal(amount || 0).gt(0) && safeDecimal(expandToken(amount, decimals)).lt(1)) {
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
    available$: (safeNumber(data.available) * safeNumber(price)).toLocaleString(undefined, USD_FORMAT),
    disabled,
  };
};
