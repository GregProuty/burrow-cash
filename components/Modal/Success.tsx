import { Box } from "@mui/material";
import React from "react";
import { CancelButton } from "./button";

interface SuccessModalProps {
  handleClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ handleClose }) => {
  return (
    <Box
      style={{
        border: "1px solid #565874",
      }}
      sx={{ p: ["20px", "20px"] }}
      className="border-none rounded-md overflow-hidden bg-[#14161F]"
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 -ml-1"
          >
            <path
              d="M3.8 12C3.8 7.47126 7.47126 3.8 12 3.8C16.5287 3.8 20.2 7.47126 20.2 12C20.2 16.5287 16.5287 20.2 12 20.2C7.47126 20.2 3.8 16.5287 3.8 12Z"
              stroke="#97FF8B"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 12L11 14L15 10"
              stroke="#97FF8B"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-white text-base font-semibold">Request Submitted</p>
        </div>

        <div className="flex flex-col opacity-60 mt-4">
          <p className="mb-4">Your supply request has been sent!</p>
          <p>
            It might take a few minutes before it is confirmed on-chain. When it does, it will
            appear in your portfolio. Meanwhile, you can track progress in your wallet.
          </p>
        </div>
        <CancelButton className="mt-4" onClick={handleClose}>
          Done
        </CancelButton>
      </div>
    </Box>
  );
};

export default SuccessModal;
