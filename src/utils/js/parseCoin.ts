import * as numeral from "numeral";
import big, { BigSource } from "big.js";
export const UST_MAX_DECIMAL_POINTS = 6;
export const LUNA_MAX_DECIMALS_POINTS = 6;

const PRINT_DECIMAL_POINTS = 3;

export const toDecimal = (num: BigSource, decimalPoints = 6): string => {
  const decimalNum = big(num).div(10 ** decimalPoints);
  return parseFloat(decimalNum.toString()).toFixed(PRINT_DECIMAL_POINTS).toString();
};

export const formatDecimal = (num: BigSource) => {
  const decimalNum = toDecimal(num);
  const [integer, decimal] = decimalNum.split(".");
  return `${numeral(integer).format("0")}${decimal ? `.${decimal}` : ""}`;
};
export const formatLUNADecimal = (num: BigSource) => `${formatDecimal(num)} LUNA`;

export function formatNiceLuna(num: BigSource) {
  return {
    currency: "LUNA",
    amount: formatDecimal(num),
  };
}
