// @flow
import React from 'react'
import { unformat } from 'accounting-js'
import BigNumber from 'bignumber.js'
import toDecimalFormString from 'number-to-decimal-form-string-x'

import type { Side } from '../../../types/orders'
import { getEstimatedCollateral } from '../../../store/services/api/engine'
// import { isTomoWallet, isMobile } from '../../../utils/helpers'
import {pricePrecision as defaultPricePrecision} from '../../../config/tokens'
import { isMobile, estimateProfit } from '../../../utils/helpers'

type Props = {
  side: Side,
  askPrice: number,
  bidPrice: number,
  baseTokenBalance: number,
  quoteTokenBalance: number,
  baseTokenSymbol: string,
  quoteTokenSymbol: string,
  baseTokenDecimals: number,
  quoteTokenDecimals: number,
  fee: number,
  authenticated: boolean,
  sendNewOrder: (string, number, number) => void,
}

type State = {
  side: SIDE,
  fraction: number,
  priceType: string,
  borrowInterest: string,
  lendInterest: string,
  borrowAmount: string,
  lendAmount: string,
}

function withOrderFormLogic(WrappedComponent) {
  return class OrderForm extends React.PureComponent<Props, State> {
    static defaultProps = {
      authenticated: false,
      bidPrice: '',
      askPrice: '',
      baseTokenBalance: '',
      quoteTokenBalance: '',
    }

    state = {
      side: 'BORROW',
      fraction: 0,
      priceType: 'null',
      borrowInterest: '',
      lendInterest: '',
      borrowAmount: '',
      lendAmount: '',
      interestStep: toDecimalFormString(1/Math.pow(10, 2)),
      amountStep: toDecimalFormString(1/Math.pow(10, 0)),
      errorBuy: null,
      errorSell: null,
      isShowBuyMaxAmount: false,
      isShowSellMaxAmount: false,
      dirtyPriceForm: false,
      collateralSelected: this.props.collateralTokens ? this.props.collateralTokens[0] : {},
      profit: '',
      isFirstTime: true,
      estimateCollateral: '',
    }

    buyPriceInput = React.createRef()
    sellPriceInput = React.createRef()
    buyAmountInput = React.createRef()
    sellAmountInput = React.createRef()

    componentDidUpdate(prevProps) {
      const {isFirstTime} = this.state
      const {collateralTokens: prevCollaterals, selectedOrder: prevSelectedOrder, currentPairData: prevPairData} = prevProps
      const {collateralTokens: currCollaterals, selectedOrder: currSelectedOrder, currentPairData} = this.props

      if (prevCollaterals.length === 0 && currCollaterals.length > 0) {        
        this.setState({
          collateralSelected: currCollaterals[0],
        })
      }

      // Set interest to current pair data interest
      if ((isFirstTime && !currSelectedOrder && currentPairData) 
      || (prevPairData && prevPairData.pair !== currentPairData.pair)) {
        this.setState({
          borrowInterest: currentPairData.close.toFixed(2),
          lendInterest: currentPairData.close.toFixed(2),
          isFirstTime: false,
        })
      }

      // Select order from orderbook
      if (!prevSelectedOrder && currSelectedOrder) {
        this.handleSelectFromOrderbook(currSelectedOrder)
      }

      if (prevSelectedOrder && 
        (prevSelectedOrder.interest !== currSelectedOrder.interest ||
        prevSelectedOrder.total !== currSelectedOrder.total ||
        prevSelectedOrder.type !== currSelectedOrder.type)
      ) {
        this.handleSelectFromOrderbook(currSelectedOrder)
      }
    }

    handleSelectFromOrderbook = (order) => {
      const { interest, type, total } = order
      const { currentPair: { termValue }} = this.props

      if (order.side === 'BORROW') {
        const profit = (type === 'amount') ? estimateProfit(interest, total, termValue) : ''
        
        this.setState({
          borrowInterest: interest,
          borrowAmount: '',
          lendInterest: interest,
          lendAmount: (type === 'amount' && !isMobile()) ? total : '',
          profit,
        })
      } else {
        this.setState({
          borrowInterest: interest,
          borrowAmount: (type === 'amount' && !isMobile()) ? total : '',
          lendInterest: interest,
          lendAmount: '',
        }, () => {
          if (type === 'amount' && !isMobile()) {
            if (window.estimateTimer) clearTimeout(window.estimateTimer)

            window.estimateTimer = setTimeout(async () => {
              const qs = {
                amount: Number(total),
                lendingToken: this.props.currentPair.lendingTokenAddress,
                collateralToken: this.state.collateralSelected.address,
              }
              const { estimateCollateralAmount } = await getEstimatedCollateral(qs)
              this.setState({
                estimateCollateral: estimateCollateralAmount,
              })
            }, 500)
          }
        })
      }
    }

    onInputChange = (side: SIDE = 'BORROW', { target }: Object) => {
      const { authenticated } = this.props
      const interestPrecision = 2
      const amountPrecision = 2
      let { value } = target

      value = value.replace(/[^0-9.]/g, '').replace(/^0+/g, '0')    
      value = value.match(/^0[1-9]/g) ? value.replace(/^0/, '') : value
      value = value.match(/^\.[1-9]*/g) ? value.replace(/^./, '0.') : value
      value = value.match(/^[0-9]*\.[0-9]*\.$/g) ? value.replace(/.$/, '') : value

      switch (target.name) {
        case 'interest':        
          const interestPattern = new RegExp(`^[0-9]*\\.[0-9]{${interestPrecision + 1},}$`, 'g')
          if (interestPattern.test(value)) return
          this.handleInterestChange(value, side)
          break      
        case 'amount':
          const amountPattern = new RegExp(`^[0-9]*\\.[0-9]{${amountPrecision + 1},}$`, 'g')
          if (amountPattern.test(value)) return
          this.handleAmountChange(value, side)
          break
        case 'fraction':
          authenticated && this.handleUpdateAmountFraction(value, side)
          break
        default:
          break
      }
    }

    handleInterestChange = (interest, side) => {    
      this.resetErrorObject(side)
    
      if (side === 'BORROW') {
        this.setState({ borrowInterest: interest })
      } else { 
        const { lendAmount } = this.state

        if (Number(interest) && Number(lendAmount)) {
          const { currentPair: { termValue }} = this.props
          const termDays = (Number(termValue)/60/60/24)
          const rate = BigNumber(interest).div(100)
          const profitPerYear = rate.times(lendAmount)
          const profitPerDay = profitPerYear.div(365)
          const profit = profitPerDay.times(termDays).toFixed(defaultPricePrecision)        

          return this.setState({
            lendInterest: interest,
            profit,
          })
        }
          
        this.setState({ lendInterest: interest })
      }    
    }

    handleAmountChange = (amount, side) => {
      this.resetErrorObject(side)

      if (side === 'BORROW') {
        if ( window.estimateTimer) clearTimeout(window.estimateTimer)
        if (!amount || Number(amount) === 0) return this.setState({ borrowAmount: amount, estimateCollateral: '' })

        this.setState({ borrowAmount: amount }, () => {
          window.estimateTimer = setTimeout(async () => {
            const qs = {
              amount: Number(amount),
              lendingToken: this.props.currentPair.lendingTokenAddress,
              collateralToken: this.state.collateralSelected.address,
            }
            const { estimateCollateralAmount } = await getEstimatedCollateral(qs)
            this.setState({
              estimateCollateral: estimateCollateralAmount,
            })
          }, 500)
        })
      } else {
        if (!amount || Number(amount) === 0) return this.setState({ lendAmount: amount, profit: '' })

        const { lendInterest } = this.state
        const { currentPair: { termValue }} = this.props
        const profit = estimateProfit(lendInterest, amount, termValue)

        this.setState({ profit, lendAmount: amount })
      }
    }

    handleSendOrder = (side: SIDE) => {

      const error = this.validateInput(side)
      if (error) {
        (side === 'BORROW') ? this.setState({ errorBuy: error }) : this.setState({ errorSell: error })
        return
      }

      const { borrowInterest, lendInterest, borrowAmount, lendAmount, collateralSelected } = this.state
      const { currentPair, sendNewLendingOrder } = this.props    

      if (side === 'BORROW'){
        const order = {
          side, 
          amount: borrowAmount, 
          interest: borrowInterest,
          collateralToken: collateralSelected.address,
          term: currentPair.termValue,
          lendingToken: currentPair.lendingTokenAddress,
        }

        sendNewLendingOrder(order)
      } else {
        const order = {
          side, 
          amount: lendAmount, 
          interest: lendInterest,
          term: currentPair.termValue,
          lendingToken: currentPair.lendingTokenAddress,
        }

        sendNewLendingOrder(order)
      }
      
      this.setState({
        borrowAmount: '',
        borrowInterest: '',
        lendAmount: '',
        lendInterest: '',
        estimateCollateral: '',
      })
    }

    handleUpdateAmountFraction = (fraction: string, side: SIDE) => {
      const { lendingToken, authenticated } = this.props

      if (!authenticated) return

      if (side === 'INVEST') {
        const { lendInterest } = this.state
        const lendAmount = (BigNumber(lendingToken.availableBalance).div(100)).times(fraction).toFixed(8)
        const { currentPair: { termValue }} = this.props
        const profit = estimateProfit(lendInterest, lendAmount, termValue)

        this.setState({
          profit,
          fraction,
          lendAmount,
          errorBuy: null,
          errorSell: null,
        })
      }
    }

    handleCollateralSelect = (collateralToken) => {  
      if ( window.estimateTimer) clearTimeout(window.estimateTimer)
      
      this.setState({
        collateralSelected: collateralToken,
      }, () => {
        if (!this.state.borrowAmount) return
        
        window.estimateTimer = setTimeout(async () => {
          const qs = {
            amount: Number(this.state.borrowAmount),
            lendingToken: this.props.currentPair.lendingTokenAddress,
            collateralToken: this.state.collateralSelected.address,
          }
          const { estimateCollateralAmount } = await getEstimatedCollateral(qs)
          this.setState({
            estimateCollateral: estimateCollateralAmount,
          })
        }, 500)
      })
    }

    handleDecreasePrice = (event, side: SIDE) => {
      event.preventDefault()

      let {
        state: {
          borrowInterest, 
          lendInterest, 
          borrowAmount, 
          lendAmount, 
          interestStep,
          pricePrecision,
        },
        buyPriceInput,
        sellPriceInput,
      } = this

      if (side === 'BORROW') {
        buyPriceInput.current.focus()

        borrowInterest = borrowInterest ? borrowInterest : 0
        let bigBuyPrice = BigNumber(borrowInterest).minus(BigNumber(interestStep))
        bigBuyPrice = bigBuyPrice.gt(BigNumber(interestStep)) ? bigBuyPrice : BigNumber(interestStep)

        if (borrowInterest && borrowAmount) {
          const bigBuyTotal = bigBuyPrice.times(borrowAmount)

          this.setState({
            borrowInterest: bigBuyPrice.toFixed(pricePrecision),
            buyTotal: bigBuyTotal.toFixed(pricePrecision),
          })
        } else {
          this.setState({
            borrowInterest: bigBuyPrice.toFixed(pricePrecision),
            buyTotal: '',
          })
        }
      } else {
        sellPriceInput.current.focus()

        lendInterest = lendInterest ? lendInterest : 0
        let bigSellPrice = BigNumber(lendInterest).minus(BigNumber(interestStep))
        bigSellPrice = bigSellPrice.gt(BigNumber(interestStep)) ? bigSellPrice : BigNumber(interestStep)

        if (lendInterest && lendAmount) {
          const bigSellTotal = bigSellPrice.times(BigNumber(lendAmount))

          this.setState({
            lendInterest: bigSellPrice.toFixed(pricePrecision),
            sellTotal: bigSellTotal.toFixed(pricePrecision),
          })
        } else {
          this.setState({
            lendInterest: bigSellPrice.toFixed(pricePrecision),
            sellTotal: '',
          })
        }
      }
    }

    handleIncreasePrice = (event, side: SIDE) => {
      event.preventDefault()

      let {
        state: {
          borrowInterest, 
          lendInterest, 
          borrowAmount, 
          lendAmount, 
          interestStep,
          pricePrecision,
        },
        buyPriceInput,
        sellPriceInput,
      } = this

      if (side === 'BORROW') {
        buyPriceInput.current.focus()

        borrowInterest = borrowInterest ? borrowInterest : 0
        const bigBuyPrice = BigNumber(borrowInterest).plus(BigNumber(interestStep))

        if (borrowInterest && borrowAmount) {
          const bigBuyTotal = bigBuyPrice.times(BigNumber(borrowAmount))

          this.setState({
            borrowInterest: bigBuyPrice.toFixed(pricePrecision),
            buyTotal: bigBuyTotal.toFixed(pricePrecision),
          })
        } else {
          this.setState({
            borrowInterest: bigBuyPrice.toFixed(pricePrecision),
            buyTotal: '',
          })
        }
      } else {
        sellPriceInput.current.focus()

        lendInterest = lendInterest ? lendInterest : 0
        const bigSellPrice = BigNumber(lendInterest).plus(BigNumber(interestStep))

        if (lendInterest && lendAmount) {
          const bigSellTotal = bigSellPrice.times(BigNumber(lendAmount))

          this.setState({
            lendInterest: bigSellPrice.toFixed(pricePrecision),
            sellTotal: bigSellTotal.toFixed(pricePrecision),
          })
        } else {
          this.setState({
            lendInterest: bigSellPrice.toFixed(pricePrecision),
            sellTotal: '',
          })
        }
      }
    }

    handleDecreaseAmount = (event, side: SIDE) => {
      event.preventDefault()

      let {
        state: {
          borrowAmount, 
          lendAmount, 
          borrowInterest, 
          lendInterest, 
          amountStep,
          amountPrecision,
        },
        buyAmountInput,
        sellAmountInput,
      } = this

      if (side === 'BORROW') {
        buyAmountInput.current.focus()

        borrowAmount = borrowAmount ? borrowAmount : 0
        let bigBuyAmount = BigNumber(borrowAmount).minus(BigNumber(amountStep)) 
        bigBuyAmount = bigBuyAmount.gt(BigNumber(amountStep)) ? bigBuyAmount : BigNumber(amountStep)

        if (borrowAmount && borrowInterest) {
          const bigBuyTotal = bigBuyAmount.times(BigNumber(borrowInterest))

          this.setState({
            borrowAmount: bigBuyAmount.toFixed(amountPrecision),
            buyTotal: bigBuyTotal.toFixed(amountPrecision),
          })
        } else {
          this.setState({
            borrowAmount: bigBuyAmount.toFixed(amountPrecision),
            buyTotal: '',
          })
        }
      } else {
        sellAmountInput.current.focus()

        lendAmount = lendAmount ? lendAmount : 0
        let bigSellAmount = BigNumber(lendAmount).minus(BigNumber(amountStep))
        bigSellAmount = bigSellAmount.gt(BigNumber(amountStep)) ? bigSellAmount : BigNumber(amountStep)

        if (lendAmount && lendInterest) {
          const bigSellTotal = bigSellAmount.times(BigNumber(lendInterest))
          
          this.setState({
            lendAmount: bigSellAmount.toFixed(amountPrecision),
            sellTotal: bigSellTotal.toFixed(amountPrecision),
          })
        } else {
          this.setState({
            lendAmount: bigSellAmount.toFixed(amountPrecision),
            sellTotal: '',
          })
        }
      }
    }

    handleIncreaseAmount = (event, side: SIDE) => {
      event.preventDefault()

      let {
        state: {
          borrowAmount, 
          lendAmount, 
          borrowInterest, 
          lendInterest, 
          amountStep,
          amountPrecision,
        }, 
        buyAmountInput, 
        sellAmountInput,
      } = this

      borrowInterest = borrowInterest ? borrowInterest : 0
      lendInterest = lendInterest ? lendInterest : 0
      borrowAmount = borrowAmount ? borrowAmount : 0
      lendAmount = lendAmount ? lendAmount : 0 

      if (side === 'BORROW') {
        buyAmountInput.current.focus()

        borrowAmount = borrowAmount ? borrowAmount : 0
        const bigBuyAmount = BigNumber(borrowAmount).plus(BigNumber(amountStep))

        if (borrowAmount && borrowInterest) {
          const bigBuyTotal = bigBuyAmount.times(BigNumber(borrowInterest))

          this.setState({
            borrowAmount: bigBuyAmount.toFixed(amountPrecision),
            buyTotal: bigBuyTotal.toFixed(amountPrecision),
          })
        } else {
          this.setState({
            borrowAmount: bigBuyAmount.toFixed(amountPrecision),
            buyTotal: '',
          })
        }
      } else {
        sellAmountInput.current.focus()

        lendAmount = lendAmount ? lendAmount : 0 
        const bigSellAmount = BigNumber(lendAmount).plus(BigNumber(amountStep))

        if (lendAmount && lendInterest) {
          const bigSellTotal = bigSellAmount.times(BigNumber(lendInterest))

          this.setState({
            lendAmount: bigSellAmount.toFixed(amountPrecision),
            sellTotal: bigSellTotal.toFixed(amountPrecision),
          })
        } else {
          this.setState({
            lendAmount: bigSellAmount.toFixed(amountPrecision),
            sellTotal: '',
          })
        }
      }
    }

    validateInput(side: SIDE) {
      const { 
        borrowInterest, 
        lendInterest, 
        borrowAmount, 
        lendAmount, 
        collateralSelected,
        estimateCollateral,
      } = this.state

      const {
        lendingToken,
        collateralTokens,
      } = this.props

      if (side === 'BORROW') {
        const collateralSelectedData = (collateralTokens && collateralSelected.symbol) ? collateralTokens.find(token => token.symbol === collateralSelected.symbol) : null
        const collateralBalance = collateralSelectedData ? collateralSelectedData.availableBalance : 0

        switch (true) {
          case (!borrowInterest || BigNumber(borrowInterest).eq(0)):
            return {
              type: 'interest',
              message: 'Please input interest',
            }

          case (!borrowAmount || BigNumber(borrowAmount).eq(0)):
            return {
              type: 'amount',
              message: 'Please input amount',
            }
          case (BigNumber(collateralBalance).lt(estimateCollateral)):
            return {
              type: 'total',
              message: 'Your balance is not enough',
            }
          default:
            return null 
        }
      } else {
        const lendingTokenBalance = lendingToken ? Number(lendingToken.availableBalance) : 0

        switch(true) {
          case (!lendInterest || BigNumber(lendInterest).eq(0)):
            return {
              type: 'interest',
              message: 'Please input interest',
            }
          case (!lendAmount || BigNumber(lendAmount).eq(0)):
            return {
              type: 'amount',
              message: 'Please input amount',
            }
          case (BigNumber(lendingTokenBalance).lt(lendAmount)):
            return {
              type: 'balance',
              message: 'Your balance is not enough',
            }
          default:
            return null
        }
      }
    }

    resetErrorObject = (side: SIDE) => {
      switch (side) {
        case 'BORROW':
          this.setState({
            errorBuy: null,
          })

          break
        case 'LEND':
          this.setState({
            errorSell: null,
          })

          break
        default:
          this.setState({
            errorBuy: null,
            errorSell: null,
          })
      }
    }

    onInputFocus = (side: SIDE, { target }: Object) => {
      if (target.name === 'amount') {
        (side === 'BORROW') ? this.setState({ isShowBuyMaxAmount: true }) : this.setState({ isShowSellMaxAmount: true })
      }
    }

    onInputBlur = (side: SIDE, { target }: Object) => {
      if (target.name === 'amount') {
        (side === 'BORROW') ? this.setState({ isShowBuyMaxAmount: false }) : this.setState({ isShowSellMaxAmount: false })
      }
    }

    calcMaxAmount = (borrowInterest) => {
      let buyMaxAmount = 0
      let sellMaxAmount = 0
      const { authenticated, quoteTokenBalance, baseTokenBalance, fee } = this.props
      const { amountPrecision } = this.state

      if (authenticated) {
        if (unformat(borrowInterest) && quoteTokenBalance) {
          const multiplier = Math.pow(10, 18)
          const bigBuyTotalMultiplier = BigNumber(quoteTokenBalance).times(multiplier).div(1 + fee)
          const bigBuyAmountMultiplier = bigBuyTotalMultiplier.div(borrowInterest)
          buyMaxAmount = bigBuyAmountMultiplier.div(multiplier).toFixed(amountPrecision)
        }

        sellMaxAmount = BigNumber(baseTokenBalance).toFixed(amountPrecision)
      }

      return { buyMaxAmount, sellMaxAmount }
    }

    render() {
      const {
        state: {
          side,
          fraction,
          priceType,
          borrowInterest,
          lendInterest,
          borrowAmount,
          lendAmount,
          errorBuy,
          errorSell,
          isShowBuyMaxAmount,
          isShowSellMaxAmount,
          collateralSelected,
          profit,
          estimateCollateral,
        },
        props: {
          currentPair,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          baseTokenBalance,
          quoteTokenBalance,
          authenticated,
          redirectToLoginPage,
          loading,
          collateralTokens,
          lendingToken,
          toggleWarning,
        },
        onInputChange,
        onInputFocus,
        onInputBlur,
        handleChangeOrderType,
        handleSendOrder,
        handleDecreasePrice,
        handleIncreasePrice,
        handleDecreaseAmount,
        handleIncreaseAmount,
        buyPriceInput,
        sellPriceInput,
        buyAmountInput,
        sellAmountInput,
        handleCollateralSelect,
      } = this

      const { buyMaxAmount, sellMaxAmount } = this.calcMaxAmount(borrowInterest)        
      const collateralSelectedData = collateralSelected ? collateralTokens.find(token => token.symbol === collateralSelected.symbol) : collateralSelected

      return (
        <WrappedComponent
          side={side}
          fraction={fraction}
          priceType={priceType}
          borrowInterest={borrowInterest}
          lendInterest={lendInterest}
          borrowAmount={borrowAmount}
          lendAmount={lendAmount}
          buyMaxAmount={buyMaxAmount}
          sellMaxAmount={sellMaxAmount}
          baseTokenSymbol={baseTokenSymbol}
          quoteTokenSymbol={quoteTokenSymbol}
          baseTokenDecimals={baseTokenDecimals}
          quoteTokenDecimals={quoteTokenDecimals}
          baseTokenBalance={baseTokenBalance}
          quoteTokenBalance={quoteTokenBalance}
          onInputChange={onInputChange}
          onInputFocus={onInputFocus}
          onInputBlur={onInputBlur}
          handleChangeOrderType={handleChangeOrderType}
          handleSendOrder={handleSendOrder}
          handleDecreasePrice={handleDecreasePrice}
          handleIncreasePrice={handleIncreasePrice}
          handleDecreaseAmount={handleDecreaseAmount}
          handleIncreaseAmount={handleIncreaseAmount}
          errorBuy={errorBuy}
          errorSell={errorSell}
          isShowBuyMaxAmount={isShowBuyMaxAmount}
          isShowSellMaxAmount={isShowSellMaxAmount}
          buyPriceInput={buyPriceInput}
          sellPriceInput={sellPriceInput}
          buyAmountInput={buyAmountInput}
          sellAmountInput={sellAmountInput}
          authenticated={authenticated}
          redirectToLoginPage={redirectToLoginPage}
          loading={loading}
          collateralTokens={collateralTokens}
          collateralSelected={collateralSelectedData}
          onCollateralSelect={handleCollateralSelect}
          profit={profit}
          currentPair={currentPair}
          lendingToken={lendingToken}
          estimateCollateral={estimateCollateral}
          toggleWarning={toggleWarning}
        />
      )
    }
  }
}

export default withOrderFormLogic
