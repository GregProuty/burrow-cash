import { styled } from "@mui/material/styles";
import { Toolbar, Link, MenuItem } from "@mui/material";
import { display } from "@mui/system";
// import "@fontsource/figtree"; // If using fontsource package

export const Wrapper = styled("div")(({ theme }) => ({
  display: "flex", // Enable flex layout
  alignItems: "center",
  justifyContent: "space-between", // Ensure children spread out
  width: "100%", // Full width
  position: "relative",
}));

export const Logo = styled("div")(() => ({
  display: "flex",
  alignItems: "center",
  gridArea: "logo",
  justifySelf: "start",
  alignSelf: "center",
  gap: "8px",
  cursor: "pointer",
}));

export const Menu = styled("div")(({ theme }) => ({
  display: "flex", // Ensure flex layout
  flexGrow: 1, // Allow the element to grow
  alignItems: "center",
  justifyContent: "flex-end",
  gridArea: "menu",
  gap: "55px", // Space between items
  width: "100%", // Take the full width of the parent
  [theme.breakpoints.down("sm")]: {
    margin: "0 auto",
    marginTop: "1rem",
  },
}));

export const LinkStyled = styled(Link)(({ theme }) => ({
  color: "white",
  fontFamily: "Figtree, sans-serif",
  textDecoration: "none",
  textAlign: "center",
  fontSize: "16px",
  lineHeight: 1.75,
  letterSpacing: "0.02857rem",
  fontWeight: 500,
  paddingTop: 4,
  paddingBottom: 4,
  cursor: "pointer",
  ":hover": {
    opacity: "0.8",
  },
}));

export const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  // color: theme.custom.text,
  color: "red",
  // color: "white",
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
}));

export const WrapperMobile = styled("div")(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
}));

export const WalletMobile = styled("div")(() => ({
  display: "flex",
}));
export const WrapperMenuMobile = styled("div")(() => ({
  backgroundColor: "#2E304B",
  borderBottomLeftRadius: "12px",
  borderBottomRightRadius: "12px",
  outline: "none",
  paddingTop: "16px",
}));
