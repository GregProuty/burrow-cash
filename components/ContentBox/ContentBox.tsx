import React from "react";
import styled from "styled-components";
import { BaseProps } from "../../interfaces/common";

export interface BoxProps extends BaseProps {
  style?: object;
  padding?: string;
}

export const ContentBox = ({ children, style, className, padding }: BoxProps) => {
  return (
    <StyledBox style={style} className={className} $padding={padding}>
      {children}
    </StyledBox>
  );
};

const StyledBox = styled.div<{ $padding?: string }>`
  position: relative;
  border-radius: 12px;
  border: 1px solid #31344d;
  background: #23253a;
  padding: ${(p) => p.$padding ?? "20px 30px"};

  @media (max-width: 767px) {
    padding: 20px;
  }
`;
