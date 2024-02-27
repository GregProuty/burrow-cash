import React, { useState } from "react";
import { Stack, Typography, Box, useTheme } from "@mui/material";
import { DateTime } from "luxon";
import styled from "styled-components";
import { twMerge } from "tailwind-merge";
// import { BrrrLogo, StakingPill, StakingCard, LiveUnclaimedAmount } from "../components/index";
import { useAppSelector } from "../redux/hooks";
import { getTotalBRRR } from "../redux/selectors/getTotalBRRR";
import { TOKEN_FORMAT } from "../store";
import { useStaking } from "../hooks/useStaking";
import { useClaimAllRewards } from "../hooks/useClaimAllRewards";
import { trackUnstake } from "../utils/telemetry";
import { unstakeNative } from "../store/actions/unstake-native";
// import { unstake } from "../store/actions/unstake";
import { useAccountId } from "../hooks/hooks";
import { ContentBox } from "../components/ContentBox/ContentBox";
import CustomButton from "../components/CustomButton/CustomButton";
import LayoutContainer from "../components/LayoutContainer/LayoutContainer";
import ModalStaking from "../screens/Staking/modalStaking";
import { modalProps } from "../interfaces/common";
import { LockIcon, Mascot, UnlockIcon } from "../components/Icons/Icons";
import { formatAPYValue, isMobileDevice } from "../helpers/helpers";
import { ConnectWalletButton } from "../components/Header/WalletButton";
import { BrrrLogo } from "../screens/Staking/components";
import { stakeNative } from "../store/actions/stake-native";

const StakingNative = () => {
  const [total, totalUnclaim, totalToken] = useAppSelector(getTotalBRRR);
  const { BRRR, stakingTimestamp, stakingNetAPY, stakingNetTvlAPY } = useStaking();
  const { handleClaimAll, isLoading } = useClaimAllRewards("staking");
  const [loadingUnstake, setLoadingUnstake] = useState(false);
  const [isModalOpen, openModal] = useState(false);
  const [modal, setModal] = useState<modalProps>();
  const accountId = useAccountId();
  const theme = useTheme();
  const isMobile = isMobileDevice();
  const unstakeDate = DateTime.fromMillis(stakingTimestamp / 1e6);
  // const disabledUnstake = !BRRR || DateTime.now() < unstakeDate;
  const disabledUnstake = false

  // added for the near native staking
  const [selectedValidator, setSelectedValidator] = useState("stardust.poolv1.near")
  const [amountToStake, setAmountToStake] = useState("1")
  const [amountToUnstake, setAmountToUnstake] = useState("1")
  const [amountToWithdraw, setAmountToWithdraw] = useState("1")
  const handleStake = async () => {
    try {
      // trackUnstake();
      await stakeNative({
        amount: amountToStake,
        validatorAddress: selectedValidator,
      });
      setLoadingUnstake(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnstake = async () => {
    try {
      // trackUnstake();
      await unstakeNative({amount: amountToUnstake, validatorAddress: selectedValidator});
      setLoadingUnstake(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWithdraw = async () => {
    try {
      // trackUnstake();
      // TODO
      await stakeNative({
        amount: amountToWithdraw,
        validatorAddress: selectedValidator,
      });
      setLoadingUnstake(true);
    } catch (e) {
      console.error(e);
    }
  };

  // if (!accountId) {
  //   return (
  //     <div>
  //       <div className="flex justify-center">
  //         <div className="mb-10">
  //           <div className="flex justify-center">
  //             <Mascot />
  //           </div>
  //         </div>
  //       </div>
  //       <div className="h2 flex justify-center">Please connect your wallet.</div>
  //     </div>
  //   );
  // }
  const totalAmount = Number(BRRR) + Number(total);

  return (
    <LayoutContainer>
      <div><h2 style={{
        textAlign: "center",
        marginBottom: "19px"
      }}>Simple staking/unstaking (native NEAR)</h2></div>
      <div style={{
        textAlign: "center",
        color: "black",
        marginBottom: "19px"
      }}>
        <label htmlFor="dropdown" style={{
          color: "white",
          padding: "6px"
        }}>Validator:</label>
        <select name="dropdown" id="dropdown" defaultValue={"stardust.poolv1.near"} onChange={(val) => {
          console.log('changed selected validator', val)
          setSelectedValidator(val.target.value)
        }}>
          <option value="stardust.poolv1.near">stardust.poolv1.near</option>
          <option value="hurry">Hurry</option>
          <option value="upmike">Up, Mike</option>
        </select>
      </div>
      <div>
        {/*<StyledStakingHeader className="flex items-end gap-4 mb-2 md:mb-12 md:items-center md:justify-center">*/}
        {/*  <div className="flex justify-center mascot">*/}
        {/*    <Mascot width={isMobile ? 122 : 158} height={isMobile ? 114 : 147} />*/}
        {/*  </div>*/}
        {/*  <div className="h2 flex items-center gap-3 mb-4 md:mb-0">*/}
        {/*    <BrrrLogo color="#D2FF3A" className="brrr-logo" />*/}
        {/*    <div className="brrr-amount flex flex-col md:flex-row md:gap-4 md:items-center">*/}
        {/*      {totalAmount > 0 ? totalAmount.toLocaleString(undefined, TOKEN_FORMAT) : 0}*/}
        {/*      <div className="text-gray-300 brrr-token">BRRR</div>*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*</StyledStakingHeader>*/}
        <div className="md:flex justify-center gap-4 md:gap-6">
          <StakingBox
            text1="💰 Available"
            value1={total > 0 ? total.toLocaleString(undefined, TOKEN_FORMAT) : 0}
            // text2="Your APY"
            // value2={`${formatAPYValue(stakingNetAPY + stakingNetTvlAPY)}%`}
            value2ClassName="text-primary"
          >
            <input id={"stakeNative"} type={"text"} style={{
                backgroundColor: "white",
                padding: "6px",
                margin: "6px",
                color: "black",
            }} defaultValue={"1"} onChange={el => {
              setAmountToStake(el.target.value)
            }} />
            {accountId ? (
              <CustomButton
                // onClick={() => setModal({ name: "staking" })}
                onClick={handleStake}
                className="w-full"
                // disabled={!total}
              >Stake NEAR</CustomButton>
            ) : (
              <ConnectWalletButton accountId={accountId} className="w-full" />
            )}
          </StakingBox>

          <StakingBox
            // logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            // disabled={BRRR === 0}
            text1="🔒 Staking"
            value1={BRRR ? BRRR.toLocaleString(undefined, TOKEN_FORMAT) : 0}
            text2={BRRR ? "Due to" : ""}
            value2={BRRR ? unstakeDate.toFormat("yyyy-MM-dd / HH:mm") : ""}
          >
            <CustomButton
              onClick={() => handleUnstake()}
              className="w-full"
              // disabled={disabledUnstake}
              color="info"
            >Unstake NEAR</CustomButton>
          </StakingBox>

          {/* <StakingBox */}
          {/*  text1="🎁 Unclaimed Reward" */}
          {/*  value1={<LiveUnclaimedAmount />} */}
          {/*  logoIcon={<GiftIcon />} */}
          {/* > */}
          {/*  <CustomButton */}
          {/*    onClick={handleClaimAll} */}
          {/*    className="w-full bg-claim border-claim text-black" */}
          {/*    color="custom" */}
          {/*    isLoading={isLoading} */}
          {/*  > */}
          {/*    Claim */}
          {/*  </CustomButton> */}
          {/* </StakingBox> */}
        </div>
      </div>

      <ModalStaking
        isOpen={modal?.name === "staking"}
        onClose={() => setModal({ name: "", data: null })}
      />
    </LayoutContainer>
  );
};

const StyledStakingHeader = styled.div`
  @media (max-width: 767px) {
    .brrr-logo {
      width: 34px !important;
      height: 34px !important;
    }
  }
`;

type StakingBoxProps = {
  logoIcon?: string | React.ReactNode;
  text1?: string | React.ReactNode;
  value1?: string | React.ReactNode;
  text2?: string;
  value2?: string;
  value2ClassName?: string;
  children?: string | React.ReactNode;
  disabled?: boolean;
};
const StakingBox = ({
                      logoIcon,
                      text1,
                      value1,
                      text2,
                      value2,
                      value2ClassName,
                      children,
                      disabled,
                    }: StakingBoxProps) => {
  return (
    <ContentBox className="mb-4 md:w-[363px]" padding="26px">
      <div className="flex justify-between flex-col h-full">
        <div className="flex justify-end lg:justify-between mb-3">
          <div className={twMerge("hidden md:block relative", disabled && "opacity-60")}>
            {/*<BrrrLogo color="#D2FF3A" />*/}
            {/*{logoIcon && (*/}
            {/*  <div className="absolute" style={{ bottom: 8, right: -8 }}>*/}
            {/*    {logoIcon}*/}
            {/*  </div>*/}
            {/*)}*/}
          </div>
          <div className="flex justify-between w-full md:text-right md:block">
            <div className="h5 text-gray-300" style={{ fontSize: 14 }}>
              {text1}
            </div>
            <div className="h2">{value1}</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-gray-380 h5 mb-2" style={{ minHeight: 20 }}>
            <div>{text2}</div>
            <div className={value2ClassName}>{value2}</div>
          </div>
          {children}
        </div>
      </div>
    </ContentBox>
  );
};

export default StakingNative;
