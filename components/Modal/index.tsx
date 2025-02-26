import { useEffect, useState, createContext, useMemo } from "react";
import { Modal as MUIModal, Box, useTheme } from "@mui/material";

import Decimal from "decimal.js";
import { useAppSelector, useAppDispatch } from "../../redux/hooks";
import { hideModal, fetchConfig, updateAmount, updatePosition } from "../../redux/appSlice";
import {
  hideModal as hideModalMEME,
  fetchConfig as fetchConfigMEME,
  updateAmount as updateAmountMEME,
  updatePosition as updatePositionMEME,
} from "../../redux/appSliceMEME";
import { getModalStatus, getAssetData, getSelectedValues } from "../../redux/appSelectors";
import { getWithdrawMaxAmount } from "../../redux/selectors/getWithdrawMaxAmount";
import { getRepayPositions } from "../../redux/selectors/getRepayPositions";
import { getAccountId } from "../../redux/accountSelectors";
import { getBorrowMaxAmount } from "../../redux/selectors/getBorrowMaxAmount";
import { recomputeHealthFactor } from "../../redux/selectors/recomputeHealthFactor";
import { recomputeHealthFactorAdjust } from "../../redux/selectors/recomputeHealthFactorAdjust";
import { recomputeHealthFactorWithdraw } from "../../redux/selectors/recomputeHealthFactorWithdraw";
import { recomputeHealthFactorSupply } from "../../redux/selectors/recomputeHealthFactorSupply";
import { recomputeHealthFactorRepay } from "../../redux/selectors/recomputeHealthFactorRepay";
import { getAssetsCategory } from "../../redux/assetsSelectors";
import { recomputeHealthFactorRepayFromDeposits } from "../../redux/selectors/recomputeHealthFactorRepayFromDeposits";
import { formatWithCommas_number } from "../../utils/uiNumber";
import { DEFAULT_POSITION, lpTokenPrefix, NBTCTokenId } from "../../utils/config";
import { Wrapper } from "./style";
import { getModalData } from "./utils";
import {
  NotConnected,
  ModalTitle,
  RepayTab,
  HealthFactor,
  Rates,
  Alerts,
  CollateralSwitch,
  CollateralTip,
  BorrowLimit,
  Receive,
} from "./components";
import Controls from "./Controls";
import Action from "./Action";
import { fetchAssets, fetchRefPrices } from "../../redux/assetsSlice";
import { fetchAssetsMEME } from "../../redux/assetsSliceMEME";
import { useDegenMode } from "../../hooks/hooks";
import { isMemeCategory } from "../../redux/categorySelectors";
import {
  CollateralTypeSelectorBorrow,
  CollateralTypeSelectorRepay,
} from "./CollateralTypeSelector";
import { useBtcAction } from "../../hooks/useBtcBalance";
import { beautifyPrice } from "../../utils/beautyNumber";
import FailureModal from "./Failure";
import SuccessModal from "./Success";

export const ModalContext = createContext(null) as any;
const Modal = () => {
  const dispatch = useAppDispatch();
  const isMeme = useAppSelector(isMemeCategory);
  const isOpen = useAppSelector(getModalStatus);
  const accountId = useAppSelector(getAccountId);
  const [failure, setFailure] = useState(false);
  const [success, setSuccess] = useState(false);

  console.log("isOpen", isOpen);
  const asset = useAppSelector(getAssetData);
  const assets = useAppSelector(getAssetsCategory());
  const { amount } = useAppSelector(getSelectedValues);
  const { isRepayFromDeposits } = useDegenMode();
  const theme = useTheme();
  const [selectedCollateralType, setSelectedCollateralType] = useState(DEFAULT_POSITION);
  const { action = "Deposit", tokenId, position } = asset;
  const { healthFactor, maxBorrowValue: adjustedMaxBorrowValue } = useAppSelector(
    action === "Withdraw"
      ? recomputeHealthFactorWithdraw(tokenId, +amount)
      : action === "Adjust"
      ? recomputeHealthFactorAdjust(tokenId, +amount)
      : action === "Supply"
      ? recomputeHealthFactorSupply(tokenId, +amount)
      : action === "Repay" && isRepayFromDeposits
      ? recomputeHealthFactorRepayFromDeposits(tokenId, +amount, selectedCollateralType)
      : action === "Repay" && !isRepayFromDeposits
      ? recomputeHealthFactorRepay(tokenId, +amount, selectedCollateralType)
      : recomputeHealthFactor(tokenId, +amount, selectedCollateralType),
  );
  const { healthFactor: single_healthFactor } = useAppSelector(
    recomputeHealthFactorWithdraw(tokenId, +amount),
  );
  const maxBorrowAmountPositions = useAppSelector(getBorrowMaxAmount(tokenId));
  const maxWithdrawAmount = useAppSelector(getWithdrawMaxAmount(tokenId));
  const repayPositions = useAppSelector(getRepayPositions(tokenId));
  const { availableBalance: btcAvailableBalance, totalFeeAmount } = useBtcAction({
    tokenId: asset?.tokenId || "",
    decimals: asset?.decimals || 0,
  });
  const receiveAmount = useMemo(() => {
    return Decimal.max(new Decimal(amount || 0).minus(totalFeeAmount || 0), 0).toFixed(
      asset?.decimals || 0,
      Decimal.ROUND_DOWN,
    );
  }, [totalFeeAmount, amount]);
  const activePosition =
    action === "Repay" || action === "Borrow"
      ? selectedCollateralType
      : tokenId?.indexOf(lpTokenPrefix) > -1
      ? tokenId
      : DEFAULT_POSITION;
  const { maxBorrowAmount = 0, maxBorrowValue = 0 } =
    maxBorrowAmountPositions[activePosition] || {};
  const repayAmount = repayPositions[selectedCollateralType];
  const { price, available, available$, rates, alerts, canUseAsCollateral } = getModalData({
    ...asset,
    maxBorrowAmount,
    maxWithdrawAmount,
    isRepayFromDeposits,
    healthFactor,
    amount,
    borrowed: repayAmount,
    poolAsset: assets[tokenId],
  });
  const handleClose = () => {
    dispatch(hideModal());
    setFailure(false);
    setSuccess(false);
  };
  // useEffect(() => {
  //   if (isOpen) {
  //     // TODO33 still need this???
  //     dispatch(fetchAssets()).then(() => dispatch(fetchRefPrices()));
  //     dispatch(fetchAssetsMEME()).then(() => dispatch(fetchRefPrices()));
  //     dispatch(fetchConfig());
  //     dispatch(fetchConfigMEME());
  //   }
  // }, [isOpen]);
  useEffect(() => {
    if (position) {
      setSelectedCollateralType(position);
    }
  }, [position]);
  // useEffect(() => {
  //   if (isMeme) {
  //     dispatch(updateAmountMEME({ isMax: false, amount: "0" }));
  //     dispatch(updatePositionMEME({ position: selectedCollateralType }));
  //   } else {
  //     dispatch(updateAmount({ isMax: false, amount: "0" }));
  //     dispatch(updatePosition({ position: selectedCollateralType }));
  //   }
  // }, [selectedCollateralType, isMeme]);
  if (action === "Adjust") {
    rates.push({
      label: "Use as Collateral",
      value: formatWithCommas_number(new Decimal(amount || 0).toFixed()),
      value$: new Decimal(price * +amount).toFixed(),
    });
  }
  // const handleClose = () => {
  //   if (isMeme) {
  //     dispatch(hideModalMEME());
  //   } else {
  //     dispatch(hideModal());
  //   }
  // };
  const repay_to_lp =
    action === "Repay" && isRepayFromDeposits && selectedCollateralType !== DEFAULT_POSITION;
  const selectedWalletId = window.selector?.store?.getState()?.selectedWalletId;
  const isBtcToken = asset.tokenId === NBTCTokenId && selectedWalletId === "btc-wallet";
  const isBtcSupply = action === "Supply" && isBtcToken;
  const isBtcWithdraw = action === "Withdraw" && isBtcToken;
  if (isBtcWithdraw) {
    const min_withdraw_amount = 0.00005;
    if (new Decimal(amount || 0).lt(min_withdraw_amount)) {
      alerts["btcWithdraw"] = {
        title: `You must withdraw at least ${min_withdraw_amount} NBTC`,
        severity: "error",
      };
    } else {
      delete alerts.btcWithdraw;
    }
  }
  const isBtc = action === "Supply" && asset.tokenId === NBTCTokenId;

  return (
    <MUIModal open={isOpen} onClose={handleClose}>
      <Wrapper
        sx={{
          "& *::-webkit-scrollbar": {
            backgroundColor: theme.custom.scrollbarBg,
          },
        }}
        style={{
          overflowY: "auto",
        }}
      >
        <ModalContext.Provider
          value={{
            position: selectedCollateralType,
          }}
        >
          {success ? (
            <SuccessModal handleClose={handleClose} />
          ) : failure ? (
            <FailureModal handleClose={handleClose} />
          ) : (
            <Box
              style={{
                border: "1px solid #565874",
              }}
              sx={{ p: ["20px", "20px"] }}
              className="border-none rounded-md overflow-hidden bg-[#14161F]"
            >
              {!accountId && <NotConnected />}
              <div className="flex items-center gap-2">
                {action === "Supply" ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6.19757 2.02049C6.68082 2.02049 7.07257 2.41224 7.07257 2.89549C7.07257 3.37874 6.68082 3.77049 6.19757 3.77049L4.97535 3.77049C5.97035 4.73955 6.84641 5.78513 7.50447 7.06425C7.65262 7.35222 7.78871 7.65003 7.91228 7.95927C8.02739 7.67776 8.15298 7.40574 8.28869 7.14196C8.96434 5.82863 9.86983 4.7615 10.8979 3.7706L9.80237 3.7706C9.31912 3.7706 8.92737 3.37885 8.92737 2.8956C8.92737 2.41235 9.31912 2.0206 9.80237 2.0206L13.2327 2.0206C13.716 2.0206 14.1077 2.41235 14.1077 2.8956L14.1077 6.32596C14.1077 6.80921 13.716 7.20096 13.2327 7.20096C12.7495 7.20096 12.3577 6.80921 12.3577 6.32596L12.3577 4.79792C11.2977 5.78842 10.4512 6.76393 9.84483 7.94254C9.21869 9.15962 8.82204 10.6464 8.77259 12.6692C8.77473 12.787 8.7758 12.9062 8.7758 13.0267C8.7758 13.0723 8.7723 13.1172 8.76555 13.161C8.73636 13.6179 8.35657 13.9794 7.89235 13.9794C7.4091 13.9794 7.01735 13.5876 7.01735 13.1044C7.01735 12.956 7.01898 12.8098 7.02221 12.6655C6.98072 10.6049 6.58207 9.0967 5.94832 7.86482C5.38194 6.76389 4.60601 5.84017 3.64221 4.9159L3.64221 6.32585C3.64221 6.8091 3.25046 7.20085 2.76721 7.20085C2.28396 7.20085 1.89221 6.8091 1.89221 6.32585L1.89221 2.89549C1.89221 2.41224 2.28396 2.02049 2.76721 2.02049L6.19757 2.02049Z"
                      fill="#FF9900"
                    />
                  </svg>
                ) : action === "Repay" ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 6.39304V10.5933M5 10.5933H9.2003M5 10.5933L8.24823 7.54112C9.21494 6.57605 10.4691 5.95129 11.8218 5.76098C13.1744 5.57067 14.5523 5.82512 15.7477 6.48598C16.9432 7.14685 17.8915 8.17834 18.4498 9.42503C19.0081 10.6717 19.146 12.0661 18.8429 13.398C18.5398 14.7299 17.8121 15.9273 16.7693 16.8096C15.7266 17.692 14.4253 18.2115 13.0616 18.29C11.6979 18.3685 10.3456 18.0017 9.20846 17.2448C8.07135 16.4879 7.21103 15.3819 6.75712 14.0936"
                      stroke="#FF9900"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M8.88544 4.74628C9.96338 4.74628 10.9972 5.17449 11.7594 5.9367C11.8733 6.05066 11.9798 6.17068 12.0785 6.29601C12.1772 6.17068 12.2837 6.05066 12.3977 5.9367C13.1599 5.17449 14.1937 4.74628 15.2716 4.74628H17.1803C17.6635 4.74628 18.0553 5.13803 18.0553 5.62128C18.0553 6.10453 17.6635 6.49628 17.1803 6.49628H15.2716C14.6578 6.49628 14.0691 6.74011 13.6351 7.17414C13.2011 7.60817 12.9573 8.19684 12.9573 8.81065L12.9573 16.2663L15.4502 13.7733C15.792 13.4316 16.346 13.4316 16.6877 13.7733C17.0294 14.115 17.0294 14.6691 16.6877 15.0108L12.701 18.9975C12.3593 19.3392 11.8052 19.3392 11.4635 18.9975L7.47682 15.0108C7.13511 14.6691 7.13511 14.115 7.47682 13.7733C7.81853 13.4316 8.37255 13.4316 8.71426 13.7733L11.2073 16.2663L11.2073 8.92529C11.2023 8.88777 11.1998 8.8495 11.1998 8.81065C11.1998 8.19684 10.956 7.60817 10.5219 7.17414C10.0879 6.74011 9.49925 6.49628 8.88544 6.49628L6.81982 6.49628C6.33658 6.49628 5.94482 6.10453 5.94482 5.62128C5.94482 5.13803 6.33658 4.74628 6.81982 4.74628H8.88544Z"
                      fill="#FF9900"
                    />
                  </svg>
                )}
                <ModalTitle asset={asset} onClose={handleClose} />
              </div>
              {action === "Repay" ? (
                <CollateralTypeSelectorRepay
                  repayPositions={repayPositions}
                  selectedCollateralType={selectedCollateralType}
                  setSelectedCollateralType={setSelectedCollateralType}
                />
              ) : null}
              <RepayTab asset={asset} />
              <Controls
                amount={amount}
                available={isBtc ? btcAvailableBalance : available}
                action={action}
                // tokenId={tokenId}
                asset={asset}
                totalAvailable={isBtc ? btcAvailableBalance : available}
                available$={available$}
              />
              <div className="flex flex-col gap-4 mt-6">
                {isBtc ? <Receive value={receiveAmount} /> : null}
                <HealthFactor value={healthFactor} />
                {repay_to_lp ? (
                  <HealthFactor value={single_healthFactor} title="Health Factor(Single)" />
                ) : null}
                <Rates rates={rates} />
                <BorrowLimit from={maxBorrowValue} to={adjustedMaxBorrowValue} />
                {!canUseAsCollateral ? (
                  <CollateralTip />
                ) : (
                  <CollateralSwitch
                    action={action}
                    canUseAsCollateral={canUseAsCollateral}
                    tokenId={asset.tokenId}
                  />
                )}
              </div>
              <Alerts data={alerts} />
              <Action
                maxBorrowAmount={maxBorrowAmount}
                maxWithdrawAmount={maxWithdrawAmount}
                healthFactor={healthFactor}
                collateralType={selectedCollateralType}
                poolAsset={assets[tokenId]}
                isDisabled={alerts["btcWithdraw"]}
                onClose={handleClose}
                setFailure={setFailure}
                setSuccess={setSuccess}
              />
            </Box>
          )}
        </ModalContext.Provider>
      </Wrapper>
    </MUIModal>
  );
};

export default Modal;
