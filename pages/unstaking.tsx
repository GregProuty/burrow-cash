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
import getConfig, { defaultNetwork } from "../utils/config";
import { Near } from "near-api-js/lib/near";
import { Account } from "near-api-js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TransactionHistory from "../components/TransactionHistory/TransactionHistory";
import { cacheTransaction, identifyOperationType } from "../components/TransactionHistory/near-transaction.service";

const nodeUrl = (getConfig(defaultNetwork) as any).nodeUrl as string

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

  const [nearProvider, setNearProvider] = useState(null)
  const [nearConn, setNearConn] = useState<Near | null>(null)
  const [accountConn, setAccountConn] = useState<Account | null>(null)
  const [formattedStakedBalance, setFormattedStakedBalance] = useState<string | null>(null)
  // Note: this value will only appear in the withdraw element if it's able to be withdrawn
  const [formattedUnstakedBalance, setFormattedUnstakedBalance] = useState<string | null>("0")
  const [isAvailableToWithdraw, setIsAvailableToWithdraw] = useState(false)

  // const context = useContext(WalletContext);
  // console.log('aloha context', context)
  const balance = useAppSelector(getAccountBalance);
  const formattedBalance = Number.parseFloat(balance).toFixed(2)
  // console.log('aloha balance', balance)
  // console.log('aloha formattedBalance', formattedBalance)

  useEffect(() => {
    const start = async () => {
      const provider = new nearAPI.providers.JsonRpcProvider({
        url: nodeUrl
      })

      // So we can use it later
      setNearProvider(provider)

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
    if (!nearProvider || !accountId) return;

    function encodeArgs(obj: any) {
      const json = JSON.stringify(obj);
      if (typeof window !== "undefined" && window.btoa) {
        return window.btoa(unescape(encodeURIComponent(json)));
      } else {
        return Buffer.from(json).toString("base64");
      }
    }

    const start = async () => {
      try {
        const args = encodeArgs({ account_id: accountId });

        // 1. Staked balance
        const stakedResult = await nearProvider.query({
          request_type: "call_function",
          account_id: selectedValidator,
          method_name: "get_account_staked_balance",
          args_base64: args,
          finality: "final",
        });
        const stakedBalance = JSON.parse(Buffer.from(stakedResult.result).toString());
        const myFormattedStakedBalance = nearAPI.utils.format.formatNearAmount(stakedBalance, 2);
        setFormattedStakedBalance(myFormattedStakedBalance);

        // 2. Unstaked balance
        const unstakedResult = await nearProvider.query({
          request_type: "call_function",
          account_id: selectedValidator,
          method_name: "get_account_unstaked_balance",
          args_base64: args,
          finality: "final",
        });
        const myUnstakedBalance = JSON.parse(Buffer.from(unstakedResult.result).toString());
        const myFormattedUnstakedBalance = nearAPI.utils.format.formatNearAmount(myUnstakedBalance, 2);
        setFormattedUnstakedBalance(myFormattedUnstakedBalance);

        // 3. Is available to withdraw
        const availableResult = await nearProvider.query({
          request_type: "call_function",
          account_id: selectedValidator,
          method_name: "is_account_unstaked_balance_available",
          args_base64: args,
          finality: "final",
        });
        const myIsAvailableToWithdraw = JSON.parse(Buffer.from(availableResult.result).toString());
        setIsAvailableToWithdraw(myIsAvailableToWithdraw);
      } catch (e) {
        console.error(e);
      }
    };

    start();
  }, [selectedValidator, nearProvider, accountId]);

  useEffect(() => {
    // Check URL parameters for transaction hashes (NEAR Wallet redirect)
    const checkUrlForTxHash = () => {
      const url = new URL(window.location.href);
      const txHashes = url.searchParams.get("transactionHashes");
      
      if (txHashes) {
        const hashArray = txHashes.split(",");
        const action = localStorage.getItem('pendingAction') || 'Transaction';
        
        // Show toast with transaction hash
        showTransactionToast('success', action, hashArray[0]);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.removeItem('pendingAction');
      }
    };
    
    // Check on component mount
    checkUrlForTxHash();
    
    // Setup event listener for browser history changes
    window.addEventListener('popstate', checkUrlForTxHash);
    return () => window.removeEventListener('popstate', checkUrlForTxHash);
  }, []);

  const showTransactionToast = (type: 'success' | 'error', action: string, txHash?: string) => {
    const message = type === 'success' ? `${action} successful!` : `${action} failed!`;
    
    if (txHash) {
      toast[type](
        <div>
          {message}
          <a 
            href={`https://nearblocks.io/txns/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3182ce", textDecoration: "underline", display: "block" }}
          >
            View on NEAR Explorer
          </a>
        </div>
      );
      
      // Add to transaction history immediately
      if (type === 'success') {
        console.log('Adding transaction to history:', { action, txHash });
        
        // Determine operation type - now using the imported function
        let operationType = identifyOperationType(null, [], action);
        
        // Determine amount
        let amount = '0';
        if (operationType === 'stake') {
          amount = amountToStake;
        } else if (operationType === 'unstake') {
          amount = amountToUnstake;
        } else if (operationType === 'withdraw') {
          amount = amountToWithdraw;
        }
        
        const operation = {
          id: txHash,
          txHash,
          operation: operationType,
          amount,
          timestamp: Date.now(),
          status: 'success' as const
        };
        cacheTransaction(operation);
      }
    } else {
      toast[type](type === 'success' 
        ? `${action} successful! Your transaction was successful.`
        : `${action} failed: Unknown error`
      );
    }
  };

  const extractTransactionHash = (result: any): string | undefined => {
    if (!result) return undefined;
    
    console.log("Extracting hash from:", result);
    
    // Check common patterns
    if (result.transaction?.hash) return result.transaction.hash;
    if (result.transactionHash) return result.transactionHash;
    if (result.transaction_outcome?.id) return result.transaction_outcome.id;
    
    // Check if result is a transaction ID string
    if (typeof result === 'string' && result.length > 20) {
      return result;
    }
    
    // Check for nested results
    if (result.results && Array.isArray(result.results)) {
      for (const subResult of result.results) {
        const hash = extractTransactionHash(subResult);
        if (hash) return hash;
      }
    }
    
    // If result is an object, try all properties
    if (typeof result === 'object' && result !== null) {
      for (const key in result) {
        if (key.toLowerCase().includes('hash') || key.toLowerCase().includes('id')) {
          if (typeof result[key] === 'string' && result[key].length > 20) {
            return result[key];
          }
        }
        
        // Recursively check nested objects (but avoid circular references)
        if (typeof result[key] === 'object' && result[key] !== null && key !== 'parent') {
          const hash = extractTransactionHash(result[key]);
          if (hash) return hash;
        }
      }
    }
    
    return undefined;
  };

  const showAccountToast = (type: 'success' | 'error', action: string) => {
    const message = type === 'success' ? `${action} successful!` : `${action} failed!`;
    
    if (accountId) {
      toast[type](
        <div>
          {message}
          <div style={{ marginTop: "8px" }}>
            <a 
              href={`https://explorer.mainnet.near.org/accounts/${accountId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3182ce", textDecoration: "underline" }}
            >
              View recent transactions on NEAR Explorer
            </a>
          </div>
        </div>
      );
    } else {
      toast[type](type === 'success' 
        ? `${action} successful! Your transaction was submitted.`
        : `${action} failed: Unknown error`
      );
    }
  };

  const handleStake = async () => {
    try {
      // Store the amount for transaction history
      localStorage.setItem('pendingAmount', amountToStake);
      localStorage.setItem('pendingAction', 'Stake');
      
      const txResult = await stakeNative({
        amount: amountToStake,
        validatorAddress: selectedValidator,
      });
      setLoadingUnstake(true);
      
      // Log the full result to see its structure
      console.log("Transaction Result:", JSON.stringify(txResult, null, 2));
      
      // Try to extract transaction hash from multiple possible locations
      const txHash = extractTransactionHash(txResult);
        
      showTransactionToast('success', 'Stake', txHash);
    } catch (e) {
      console.error("Full error:", e);
      const txHash = extractTransactionHash(e);
      showTransactionToast('error', 'Stake', txHash);
    }
  };

  const handleUnstake = async () => {
    console.log('unstake for accountId', accountId)
    if (!accountId) {
      console.log('need to log in')
      return
    }

    try {
      // Store the amount for transaction history
      localStorage.setItem('pendingAmount', amountToUnstake);
      localStorage.setItem('pendingAction', 'Unstake');
      
      const txResult = await unstakeNative({
        amount: amountToUnstake,
        validatorAddress: selectedValidator,
      });
      setLoadingUnstake(true);

      // Log the full result to see its structure
      console.log("Transaction Result:", JSON.stringify(txResult, null, 2));
      
      // Try to extract transaction hash from multiple possible locations
      const txHash = extractTransactionHash(txResult);
        
      showTransactionToast('success', 'Unstake', txHash);
    } catch (e) {
      // Optionally extract txHash from error if available
      console.error("Full error:", e);
      const txHash = extractTransactionHash(e);
      showTransactionToast('error', 'Unstake', txHash);
    }
  };

  const handleWithdraw = async () => {
    try {
      // Store the amount for transaction history
      localStorage.setItem('pendingAmount', amountToWithdraw);
      localStorage.setItem('pendingAction', 'Withdraw');
      
      const txResult = await withdrawNative({
        amount: amountToWithdraw,
        validatorAddress: selectedValidator,
      });
      setLoadingUnstake(true);
      
      // Log the full result to see its structure
      console.log("Transaction Result:", JSON.stringify(txResult, null, 2));
      
      // Try to extract transaction hash from multiple possible locations
      const txHash = extractTransactionHash(txResult);
        
      showTransactionToast('success', 'Withdraw', txHash);
    } catch (e) {
      console.error("Full error:", e);
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
    <>
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
          <select name="dropdown" id="dropdown" defaultValue={selectedValidator} onChange={(val) => {
            console.log('changed selected validator', val)
            setSelectedValidator(val.target.value)
          }}>
            <option value="stardust.poolv1.near">stardust.poolv1.near</option>
            <option value="stardust.pool.near">stardust.pool.near</option>
            <option value="zavodil.poolv1.near">zavodil.poolv1.near</option>
            <option value="polkachu.poolv1.near">polkachu.poolv1.near</option>
            <option value="udhc1.pool.near">udhc1.pool.near</option>
            <option value="nearua.poolv1.near">nearua.poolv1.near</option>
            <option value="sharpdarts.poolv1.near">sharpdarts.poolv1.near</option>
            <option value="nearweek.pool.near">nearweek.pool.near</option>
            <option value="calimero.pool.near">calimero.pool.near</option>
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
            <option value="finoa.poolv1.near">finoa.poolv1.near</option>
            <option value="inotel.poolv1.near">inotel.poolv1.near</option>
            <option value="stakin.poolv1.near">stakin.poolv1.near</option>
            <option value="staking4all.poolv1.near">staking4all.poolv1.near</option>
            <option value="binancenode1.poolv1.near">binancenode1.poolv1.near</option>
            <option value="liver.pool.near">liver.pool.near</option>
            <option value="stakin.poolv1.near">stakin.poolv1.near</option>
            <option value="here.poolv1.near">here.poolv1.near</option>
            <option value="rekt.poolv1.near">rekt.poolv1.near</option>
            <option value="kiln-1.poolv1.near">kiln-1.poolv1.near</option>
            <option value="epic.poolv1.near">epic.poolv1.near</option>
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
              value1={!accountId || isNaN(Number(formattedBalance)) ? "—" : formattedBalance}
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
              value1={(formattedUnstakedBalance !== "0" && isAvailableToWithdraw) ? formattedUnstakedBalance : '0'}
              text2={"Note: the balance reflects the amount available for immediate withdrawal"}
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

        <TransactionHistory validatorAddress={selectedValidator} />

        <ModalStaking
          isOpen={modal?.name === "staking"}
          onClose={() => setModal({ name: "", data: null })}
        />
      </LayoutContainer>
      <ToastContainer />
    </>
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
            <div className="h2" style={{ color: "#fff" }}>{value1}</div>
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