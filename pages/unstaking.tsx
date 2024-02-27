import React, { useContext, useEffect, useState } from "react";
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
import { ConnectWalletButton, WalletContext } from "../components/Header/WalletButton";
import { BrrrLogo } from "../screens/Staking/components";
import { stakeNative } from "../store/actions/stake-native";
import { withdrawNative } from "../store/actions/withdraw-native";
import { getAccountBalance } from "../redux/accountSelectors";
import * as nearAPI from 'near-api-js'
import { defaultNetwork } from "../utils/config";
import { Near } from "near-api-js/lib/near";
import { Account } from "near-api-js";

const nodeUrl = "https://rpc.mainnet.near.org"

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

  // const [nearProvider, setNearProvider] = useState(null)
  const [nearConn, setNearConn] = useState<Near | null>(null)
  const [accountConn, setAccountConn] = useState<Account | null>(null)
  const [formattedStakedBalance, setFormattedStakedBalance] = useState<string | null>(null)

  // const context = useContext(WalletContext);
  // console.log('aloha context', context)
  const balance = useAppSelector(getAccountBalance);
  const formattedBalance = Number.parseFloat(balance).toFixed(2)
  console.log('aloha balance', balance)
  console.log('aloha formattedBalance', formattedBalance)

  useEffect(() => {
    const start = async () => {
      const provider = new nearAPI.providers.JsonRpcProvider({
        url: nodeUrl
      })

      // So we can use it later
      // setNearProvider(provider)

      const nearConn = await nearAPI.connect({
        networkId: defaultNetwork,
        nodeUrl: nodeUrl,
        keyStore: new nearAPI.keyStores.InMemoryKeyStore(),
        headers: {}
      })

      setNearConn(nearConn)
      // we just need this to query, but you must supply something valid
      const accountConn = await nearConn.account("mike.near")
      setAccountConn(accountConn)
      // accountConn.viewFunction(selectedValidator,)
    }
    start()
  }, []);

  useEffect(() => {
    if (!accountConn || !accountId) return
    // when they change validators, see if there's an
    // unstaked balance and withdraw balance

    const start = async () => {
      const stakedBalance = await accountConn.viewFunction(
        selectedValidator,
        "get_account_staked_balance",
        { account_id: accountId },
        // blockQuery: {finality: "final"}
      )
      console.log('aloha stakedBalance', stakedBalance)
      const myFormattedStakedBalance = nearAPI.utils.format.formatNearAmount(stakedBalance, 2)
      console.log('aloha formattedStakedBalance', myFormattedStakedBalance)
      setFormattedStakedBalance(myFormattedStakedBalance)
      // const stakedBalance = await accountConn.viewFunction({
      //   contractId: selectedValidator,
      //   methodName: "get_account_staked_balance",
      //   args: { account_id: accountId },
      //   blockQuery: {finality: "final"}
      // })
      // console.log('aloha stakedBalance', stakedBalance)
    }

    start()
  }, [selectedValidator, accountConn]);

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
    console.log('unstake for accountId', accountId)
    if (!accountId) {
      console.log('need to log in')
      return
    }

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
      await withdrawNative({
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
  // const totalAmount = Number(BRRR) + Number(total);

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
          <option value="udhc1.pool.near">udhc1.pool.near</option>
          <option value="nearua.poolv1.near">nearua.poolv1.near</option>
          <option value="sharpdarts.poolv1.near">sharpdarts.poolv1.near</option>
          <option value="nearweek.poolv1.near">nearweek.poolv1.near</option>
          <option value="calimero.poolv1.near">calimero.poolv1.near</option>
          <option value="shardlabs.poolv1.near">shardlabs.poolv1.near</option>
          <option value="hashquark.poolv1.near">hashquark.poolv1.near</option>
          <option value="everstake.poolv1.near">everstake.poolv1.near</option>
          <option value="chorusone.poolv1.near">chorusone.poolv1.near</option>
          <option value="nodeasy.poolv1.near">nodeasy.poolv1.near</option>
          <option value="consensus_finoa_01.poolv1.near">consensus_finoa_01.poolv1.near</option>
          <option value="consensus_finoa_00.poolv1.near">consensus_finoa_00.poolv1.near</option>
          <option value="ledgerbyfigment.poolv1.near">ledgerbyfigment.poolv1.near</option>
          <option value="fish.poolv1.near">fish.poolv1.near</option>
          <option value="masternode24.poolv1.near">masternode24.poolv1.near</option>
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
            value1={formattedBalance}
            // text2="Your APY"
            // value2={`${formatAPYValue(stakingNetAPY + stakingNetTvlAPY)}%`}
            value2ClassName="text-primary"
          >
            <input id={"stakeNative"} type={"text"} style={{
                backgroundColor: "white",
                padding: "6px",
                marginBottom: "6px",
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
              <p>Login please</p>
              // <ConnectWalletButton accountId={accountId} className="w-full" />
            )}
          </StakingBox>

          <StakingBox
            // logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            // disabled={BRRR === 0}
            text1="🔒 Staking"
            value1={formattedStakedBalance}
            // value1={BRRR ? BRRR.toLocaleString(undefined, TOKEN_FORMAT) : 0}
            // text2={BRRR ? "Due to" : ""}
            // value2={BRRR ? unstakeDate.toFormat("yyyy-MM-dd / HH:mm") : ""}
          >
            <input id={"unstakeNative"} type={"text"} style={{
              backgroundColor: "white",
              padding: "6px",
              marginBottom: "6px",
              color: "black",
            }} defaultValue={"1"} onChange={el => {
              setAmountToUnstake(el.target.value);
            }} />
            {accountId ? (
              <CustomButton
                onClick={() => handleUnstake()}
                className="w-full"
                // disabled={disabledUnstake}
                color="info"
              >Unstake NEAR</CustomButton>
            ) : (
              <p>Login please</p>
              // <ConnectWalletButton accountId={accountId} className="w-full" />
            )}
          </StakingBox>

          <StakingBox
            // logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            // logoIcon={disabledUnstake ? <LockIcon /> : <UnlockIcon />}
            // disabled={BRRR === 0}
            text1="Withdraw"
            // value1={BRRR ? BRRR.toLocaleString(undefined, TOKEN_FORMAT) : 0}
            // text2={BRRR ? "Due to" : ""}
            // value2={BRRR ? unstakeDate.toFormat("yyyy-MM-dd / HH:mm") : ""}
          >
            <input id={"withdrawNative"} type={"text"} style={{
              backgroundColor: "white",
              padding: "6px",
              marginBottom: "6px",
              color: "black",
            }} defaultValue={"1"} onChange={el => {
              setAmountToWithdraw(el.target.value);
            }} />
            {accountId ? (
              <CustomButton
                onClick={() => handleWithdraw()}
                className="w-full"
                // disabled={disabledUnstake}
                color="info"
              >Withdraw NEAR</CustomButton>
            ) : (
              <p>Login please</p>
              // <ConnectWalletButton accountId={accountId} className="w-full" />
            )}
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
