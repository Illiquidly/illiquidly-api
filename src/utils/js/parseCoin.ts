import * as numeral from 'numeral'
import big, { BigSource } from 'big.js'
export const UST_MAX_DECIMAL_POINTS = 6
export const LUNA_MAX_DECIMALS_POINTS = 6
export const toDecimal = (num: BigSource, decimalPoints = 6): string => {
    const decimalNum = big(
        big(num)
            .toFixed()
            .split('.')[0]
    ).div(10 ** decimalPoints)
    return (Math.floor(parseFloat(decimalNum.toString()) * 100) / 100)
        .toFixed(decimalPoints)
        .toString()
}
export const formatDecimal = (num: BigSource) => {
    const decimalNum = toDecimal(num)
    const [integer, decimal] = decimalNum.split('.')
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    return `${numeral(integer).format('0,0')}${decimal ? `.${decimal}` : ''}`
}
export const formatLUNADecimal = (num: BigSource) =>
    `${formatDecimal(num)} LUNA`

export function formatNiceLuna(num: BigSource) {
    return {
        currency: "LUNA",
        amount: formatDecimal(num),
    }
}