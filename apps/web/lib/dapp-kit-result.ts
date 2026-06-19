type FailedExecution = {
  status?: {
    error?: {
      message?: string;
    };
  };
};

type SuccessfulExecution = {
  digest?: string;
};

export function parseDAppKitExecutionResult(result: unknown): { digest: string } {
  const value = result as {
    FailedTransaction?: FailedExecution;
    Transaction?: SuccessfulExecution;
  };

  if (value.FailedTransaction) {
    throw new Error(value.FailedTransaction.status?.error?.message ?? 'Transaction failed');
  }

  if (value.Transaction?.digest) {
    return { digest: value.Transaction.digest };
  }

  throw new Error('Wallet did not return a transaction digest.');
}
