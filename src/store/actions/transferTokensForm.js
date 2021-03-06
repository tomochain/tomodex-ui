//@flow
import type {TxReceipt} from '../../types/common'
import type {
  ConfirmTxAction,
  TxErrorAction,
  TxStatus,
  InvalidateTxAction,
  RevertTxAction,
  SendTxAction,  
  ValidateTxAction,
  ResetFormAction,
} from '../../types/transferTokensForm'

const actionTypes = {
  txError: 'transferTokensForm/ERROR',
  validateTx: 'transferTokensForm/VALIDATE',
  invalidateTx: 'transferTokensForm/INVALIDATE',
  sendTx: 'transferTokensForm/SEND',
  confirmTx: 'transferTokensForm/CONFIRM',
  revertTx: 'transferTokensForm/REVERT',
  resetForm: 'transferTokensForm/RESET_FORM',
  updateTransferFee: 'transferTokensForm/UPDATE_TRANSFER_FEE',
}

export function txError(status: TxStatus, statusMessage: string): TxErrorAction {
  return {
    type: actionTypes.txError,
    payload: { status, statusMessage },
  }
}

export function invalidateTx(statusMessage: string): InvalidateTxAction {
  return {
    type: actionTypes.invalidateTx,
    payload: { statusMessage },
  }
}

export function validateTx(statusMessage: string, estimatedGas): ValidateTxAction {
  return {
    type: actionTypes.validateTx,
    payload: { statusMessage, estimatedGas },
  }
}

export function sendTx(hash: string): SendTxAction {
  return {
    type: actionTypes.sendTx,
    payload: { hash },
  }
}

export function revertTx(statusMessage: string, receipt: TxReceipt): RevertTxAction {
  return {
    type: actionTypes.revertTx,
    payload: { statusMessage, receipt },
  }
}

export function confirmTx(receipt: TxReceipt): ConfirmTxAction {
  return {
    type: actionTypes.confirmTx,
    payload: { receipt },
  }
}

export function resetForm(): ResetFormAction {
  return {
    type: actionTypes.resetForm,
  }
}

export function updateTransferFee(transferFee) {
  return {
    type: actionTypes.updateTransferFee,
    payload: { transferFee },
  }
}

export default actionTypes
