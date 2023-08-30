import React, { useState } from "react";
import { Stack, Typography, Box, useTheme } from "@mui/material";
import { DateTime } from "luxon";
import styled from "styled-components";
import { BrrrLogo, StakingPill, StakingCard, LiveUnclaimedAmount } from "./components";
import { useAppSelector } from "../../redux/hooks";
import { getTotalBRRR } from "../../redux/selectors/getTotalBRRR";
import { TOKEN_FORMAT } from "../../store";
import { useStaking } from "../../hooks/useStaking";
import { useClaimAllRewards } from "../../hooks/useClaimAllRewards";
import { trackUnstake } from "../../utils/telemetry";
import { unstake } from "../../store/actions/unstake";
import { StakingModal } from "./modal";
import { useAccountId } from "../../hooks/hooks";
import { ContentBox } from "../../components/ContentBox/ContentBox";
import CustomButton from "../../components/CustomButton/CustomButton";
import LayoutContainer from "../../components/LayoutContainer/LayoutContainer";
import ModalStaking from "./modalStaking";
import { modalProps } from "../../interfaces/common";
import { LockIcon, Mascot } from "../../components/Icons/Icons";
import GiftIcon from "../../public/svg/Group 24710.svg";
import { isMobileDevice } from "../../helpers/helpers";

const Staking = () => {
  const [total] = useAppSelector(getTotalBRRR);
  const { BRRR, stakingTimestamp } = useStaking();
  const { handleClaimAll, isLoading } = useClaimAllRewards("staking");
  const [loadingUnstake, setLoadingUnstake] = useState(false);
  const [isModalOpen, openModal] = useState(false);
  const [modal, setModal] = useState<modalProps>();
  const accountId = useAccountId();
  const theme = useTheme();
  const isMobile = isMobileDevice();

  const unstakeDate = DateTime.fromMillis(stakingTimestamp / 1e6);
  const disabledUnstake = DateTime.now() < unstakeDate;

  const handleUnstake = async () => {
    try {
      trackUnstake();
      await unstake();
      setLoadingUnstake(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (!accountId) {
    return (
      <div>
        <div className="flex justify-center">
          <div className="mb-10">
            <div className="flex justify-center">
              <Mascot />
            </div>
          </div>
        </div>
        <div className="h2 flex justify-center">Please connect your wallet.</div>
      </div>
    );
  }
  return (
    <LayoutContainer>
      <div>
        <StyledStakingHeader className="flex justify-between md:justify-center flex-row-reverse items-end gap-4 mb-2 md:mb-10 md:flex-col md:items-center">
          <div className="flex justify-center mascot">
            <Mascot width={isMobile ? 122 : 158} height={isMobile ? 114 : 147} />
          </div>
          <div className="h2 flex items-center gap-3 mb-4 md:mb-0">
            <BrrrLogo color="#D2FF3A" className="brrr-logo" />
            <div className="brrr-amount flex flex-col md:flex-row md:gap-4 md:items-center">
              <LiveUnclaimedAmount addAmount={total} />{" "}
              <div className="text-gray-300 brrr-token">BRRR</div>
            </div>
          </div>
        </StyledStakingHeader>
        <div className="md:flex justify-center gap-4">
          <StakingBox text1="💰 Available" value1={total.toLocaleString(undefined, TOKEN_FORMAT)}>
            <CustomButton onClick={() => setModal({ name: "staking" })} className="w-full">
              Stake
            </CustomButton>
          </StakingBox>

          <StakingBox
            logoIcon={<LockIcon />}
            text1="🔒 Staking"
            value1={BRRR.toLocaleString(undefined, TOKEN_FORMAT)}
            text2={BRRR ? "Due to" : ""}
            value2={BRRR ? unstakeDate.toFormat("yyyy-MM-dd / HH:mm") : ""}
          >
            <CustomButton onClick={handleUnstake} className="w-full" disabled={!BRRR}>
              Unstake
            </CustomButton>
          </StakingBox>

          <StakingBox
            text1="🎁 Unclaimed Reward"
            value1={<LiveUnclaimedAmount />}
            logoIcon={<GiftIcon />}
          >
            <CustomButton
              onClick={handleClaimAll}
              className="w-full bg-claim border-claim text-black"
              color="custom"
              isLoading={isLoading}
            >
              Claim
            </CustomButton>
          </StakingBox>
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
  children?: string | React.ReactNode;
};
const StakingBox = ({ logoIcon, text1, value1, text2, value2, children }: StakingBoxProps) => {
  return (
    <ContentBox className="flex-1 mb-4" padding="26px">
      <div className="flex justify-between flex-col h-full">
        <div className="flex justify-end lg:justify-between mb-2">
          <div className="hidden lg:block relative">
            <BrrrLogo color="#D2FF3A" />
            {logoIcon && (
              <div className="absolute" style={{ bottom: 8, right: -8 }}>
                {logoIcon}
              </div>
            )}
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
            <div>{value2}</div>
          </div>
          {children}
        </div>
      </div>
    </ContentBox>
  );
};

export default Staking;
