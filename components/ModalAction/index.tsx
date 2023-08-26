import { useAppSelector, useAppDispatch } from "../../redux/hooks";
import { showModal } from "../../redux/appSlice";
import { getCollateralAmount } from "../../redux/selectors/getCollateralAmount";

export function useWithdrawTrigger(tokenId: string) {
  const dispatch = useAppDispatch();
  return () => {
    dispatch(showModal({ action: "Withdraw", tokenId, amount: 0 }));
  };
}
export function useAdjustTrigger(tokenId: string) {
  const dispatch = useAppDispatch();
  const amount = useAppSelector(getCollateralAmount(tokenId));
  return () => {
    dispatch(showModal({ action: "Adjust", tokenId, amount }));
  };
}

export function useSupplyTrigger(tokenId: string) {
  const dispatch = useAppDispatch();
  return () => {
    dispatch(showModal({ action: "Supply", tokenId, amount: 0 }));
  };
}
export function useBorrowTrigger(tokenId: string) {
  const dispatch = useAppDispatch();
  return () => {
    dispatch(showModal({ action: "Borrow", tokenId, amount: 0 }));
  };
}

export function useRepayTrigger(tokenId: string) {
  const dispatch = useAppDispatch();
  return () => {
    dispatch(showModal({ action: "Repay", tokenId, amount: 0 }));
  };
}
